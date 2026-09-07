#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
카드사별 파서 어댑터의 형식 판별 + 디스패치 + 공통 후처리.

카드사마다 파일 형식이 완전히 달라서(IBK 는 HTML 위장 xls, KB 는 바이너리 xls)
읽는 부분만 카드사별로 나누고, 그 뒤 처리는 전부 여기서 공통으로 한다.

각 어댑터는 `read(path) -> list[Record]` 하나만 제공한다.
Record 에는 승인번호·날짜 같은 PII 가 들어 있고, **출력 CSV 로는 나가지 않는다.**
취소 건의 원 결제를 짝지으려면 승인번호가 필요해서 파싱 중에만 메모리에 둔다.

공통 출력 스키마
    approved_at, raw_merchant, amount, installment_months, approval_no,
    natural_key, biz_no, memo, source_card, is_aggregated, branch, branch_raw,
    needs_review, review_reason

승인일·승인번호는 출력한다. 카드번호·고객명과 성격이 다르다 — 거래 자체의
속성이고 개인을 식별하지 않는다. 승인일은 귀속연도를 정하는 세무상 필수
값이고, 둘 다 natural_key 의 재료다. 승인번호가 없으면 같은 날 같은 가맹점
같은 금액의 별개 거래가 한 키를 받아 적재가 거부된다(실측 2조합/5행).
승인번호를 출력하면 취소 페어링이 감사 가능해지는 부수 효과도 있다.
계속 버리는 것: 카드번호, 이용고객명, 이용카드명.
"""

from __future__ import annotations

import hashlib
import re
import sys
from collections import Counter
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

OUT_FIELDS = ["approved_at", "raw_merchant", "amount", "installment_months",
              "approval_no", "natural_key", "biz_no", "memo", "source_card",
              "is_aggregated", "branch", "branch_raw", "needs_review", "review_reason"]

MAGIC_OLE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"

# ── 비거래 항목 ────────────────────────────────────────────
# 지출이 아니라 카드사가 만든 정산 행이다. 전부 사업자번호가 없다.
# '할인으로 끝남' 만으로는 '포인트사용' 을 못 잡아서 목록을 명시한다.
# biz_no 가 있으면 제외하지 않는다 ('○○할인마트' 는 실제 가맹점이다).
NON_TRANSACTION_RE = re.compile(r"^(정상할인|포인트사용|.*할인)$")

# ── 합산 건 ────────────────────────────────────────────────
# 카드사가 여러 승인을 하나로 묶어 만든 행. 개별 거래가 아니고
# 가맹점도 특정되지 않는다. 제외하지 않고 표시만 한다 (여비교통 후보).
AGGREGATED_RE = re.compile(r"^(교통[-_]|지하철[-_]|버스[-_]|시외버스[-_])")

# ── 민감 업종 마스킹 ──────────────────────────────────────
MEDICAL_RE = re.compile(r"(병원|의원|약국|한의원|치과|의료원|보건소)")
MEDICAL_PREFIX = "의료_마스킹"

BIZNO_RE = re.compile(r"^\d{3}-?\d{2}-?\d{5}$")

# ── 승인내역 / 청구내역 판별 ───────────────────────────────
# 청구내역은 상호명이 뭉개져서 분류에 쓸 수 없다. 사용자가 잘못 받아오면
# 조용히 이상한 데이터가 들어가므로 헤더로 판별해 아예 차단한다.
MERCHANT_HEADERS = ("이용가맹점명", "이용하신곳", "이용하신 곳", "가맹점명", "가맹점")
APPROVAL_HEADERS = ("승인번호", "승인일시", "승인구분", "이용일", "이용일자")
BILLING_HEADERS = ("청구금액", "청구합계", "청구건수", "청구일", "청구원금",
                   "결제원금", "잔여할부", "할부수수료", "이자")

STATEMENT_GUIDE = (
    "청구내역이 아니라 승인내역(이용내역)을 받아주세요." + chr(10) +
    "     카드사 앱 -> 이용내역 조회 -> 엑셀 다운로드"
)


def classify_statement(headers: list) -> tuple:
    """헤더로 승인내역/청구내역을 가른다. (판정, 근거) 를 돌려준다."""
    hs = [re.sub(r"\s+", "", str(h or "")) for h in headers]
    joined = " ".join(hs)
    has_merchant = [h for h in MERCHANT_HEADERS if re.sub(r"\s+", "", h) in joined]
    has_approval = [h for h in APPROVAL_HEADERS if h in joined]
    has_billing = [h for h in BILLING_HEADERS if h in joined]

    if has_merchant and has_approval:
        return "승인내역", "가맹점명(%s) + 승인정보(%s)" % (has_merchant[0], has_approval[0])
    if has_billing and not has_merchant:
        return "청구내역", "청구 컬럼(%s) 있고 가맹점명 없음" % ", ".join(has_billing[:3])
    if has_merchant and not has_approval:
        return "판별불가", "가맹점명은 있는데 승인정보 컬럼이 없다"
    return "판별불가", "가맹점명·승인정보 컬럼을 찾지 못했다 (헤더: %s)" % (joined[:60] or "없음")


# 취소-원결제 폴백 매칭에서 허용하는 날짜 차이
PAIR_WINDOW_DAYS = 62


class Record(dict):
    """파싱 중간 표현. 승인번호·날짜가 들어 있으므로 출력하지 않는다."""

    def __getattr__(self, k):
        try:
            return self[k]
        except KeyError as e:
            raise AttributeError(k) from e


def make_record(merchant, amount, biz_no="", memo="", source="", approval_no="",
                when=None, is_cancel=False, installment=0, src_file="") -> Record:
    return Record(merchant=str(merchant).strip(), amount=amount, biz_no=biz_no,
                  memo=memo, source=source, approval_no=str(approval_no or "").strip(),
                  when=when, is_cancel=bool(is_cancel), installment=installment,
                  src_file=src_file, needs_review=False, review_reason="")


def parse_installment(text) -> int:
    """결제방법/이용구분에서 할부 개월을 뽑는다. 일시불이면 0."""
    s = str(text or "")
    m = re.search(r"(\d+)\s*개?월", s)
    if m:
        return int(m.group(1))
    return 0


def natural_key(approved_at: str, raw_merchant: str, amount, approval_no: str = "") -> str:
    """hash(approved_at + raw_merchant + amount + approval_no).

    기간을 겹쳐 올렸을 때 같은 거래가 두 번 적재되는 것을 막는 UNIQUE 키다.
    날짜가 없으면 만들지 않는다 — 팀원 목록(상호명만)이 그런 경우다.
    상호명은 **마스킹 전 원본**을 쓴다. 목적이 "같은 원본 파일을 두 번
    올렸을 때 중복 차단" 이므로, 원본 파일을 다시 파싱하면 같은 키가 나와야
    한다. 마스킹 인덱스(의료_마스킹_01)는 파싱 순서에 따라 흔들리므로
    그것으로 해시하면 재파싱 시 키가 바뀌어 중복 차단이 깨진다.
    CSV 에서 키를 역산할 필요는 없다 — 그건 요건이 아니다.
    """
    if not approved_at or amount is None or amount == "":
        return ""
    # 승인번호 단독은 유니크가 보장되지 않는다 — 8자리라 재사용될 수 있고
    # 카드사마다 별개 체계다. 그래서 단독 키로 쓰지 않고 기존 재료에 더한다.
    raw = "%s|%s|%s|%s" % (approved_at, raw_merchant, amount, approval_no or "")
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def parse_amount(text):
    if isinstance(text, (int, float)):
        return int(round(text))
    t = re.sub(r"[^\d\-]", "", str(text or ""))
    if not t or t == "-":
        return None
    try:
        return int(t)
    except ValueError:
        return None


def norm_bizno(text: str) -> str:
    t = re.sub(r"\s", "", str(text or ""))
    return t if BIZNO_RE.match(t) else ""


def parse_date(text):
    s = str(text or "").strip()[:10]
    for fmt in ("%Y-%m-%d", "%Y.%m.%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------- 통계
class Stats:
    def __init__(self) -> None:
        self.total = 0
        self.non_transaction = 0
        self.cancelled = 0            # 취소 행 자체
        self.paired_originals = 0     # 취소와 짝지어 함께 제외한 원 결제
        self.unpaired_cancels = 0
        self.no_amount = 0
        self.no_date = 0
        self.no_natural_key = 0
        self.dup_real: list = []      # 같은 거래가 두 번 (승인번호 동일)
        self.dup_distinct: list = []  # 별개 거래인데 키 충돌 (승인번호 다름)
        self.foreign_ccy = 0
        self.aggregated = 0
        self.kept = 0
        self.per_card: Counter = Counter()
        self.non_transaction_samples: Counter = Counter()
        self.aggregated_samples: Counter = Counter()
        self.ambiguous_cancels = 0    # 취소 대상 불확정
        self.review_flagged = 0       # needs_review 로 넘긴 행
        self.pair_log: list = []      # (상호, 금액, 매칭방법)
        self.unpaired_log: list = []  # (상호, 금액, 사유)
        self.ambiguous_log: list = []  # (상호, 금액, 후보수)
        self.risky_combos_all = 0      # 같은 상호+금액 정상결제 2건 이상 조합
        self.risky_combos_pairable = 0  # 그중 합산 행을 뺀 뒤 남는 조합
        self.medical_map: dict = {}
        self.statement_kinds: list = []   # (파일명, 판정, 근거)
        self.blocked_files: list = []     # (파일명, 판정, 근거)

    def mask_medical(self, merchant: str, biz_no: str) -> str:
        key = biz_no or merchant
        if key not in self.medical_map:
            self.medical_map[key] = "%s_%02d" % (MEDICAL_PREFIX, len(self.medical_map) + 1)
        return self.medical_map[key]


# ---------------------------------------------------------------- 형식 판별
def detect_format(path: Path) -> str:
    if path.suffix.lower() in (".txt", ".list"):
        return "teammate"
    head = path.open("rb").read(8)
    if head.startswith(MAGIC_OLE):
        return "kb"
    if head.lstrip()[:5].lower() == b"<html":
        return "ibk"
    return "unknown"


def get_adapter(name: str):
    from . import ibk, kb, teammate
    return {"ibk": ibk, "kb": kb, "teammate": teammate}.get(name)


CARD_TYPES = ("ibk", "kb", "teammate")


# ---------------------------------------------------------------- 비거래 제거
def drop_non_transactions(records: list, st: Stats) -> list:
    """할인·포인트사용 행을 먼저 걷어낸다.

    IBK 는 승인구분을 '취소또는할인' 한 칸에 묶어 주기 때문에, 이걸 먼저
    빼지 않으면 할인 17건이 전부 '짝을 못 찾은 취소' 로 리포트에 쌓인다.
    """
    kept = []
    for r in records:
        if NON_TRANSACTION_RE.match(r.merchant) and not r.biz_no:
            st.non_transaction += 1
            st.non_transaction_samples[r.merchant] += 1
            continue
        kept.append(r)
    return kept


# ---------------------------------------------------------------- 취소 페어링
def pair_cancellations(records: list, st: Stats) -> list:
    """취소 행과 그 원 결제를 함께 제외한다.

    취소 줄만 빼면 원 결제가 남아 경비가 부풀려진다 (과소신고 -> 가산세).
    반대로 **틀린 짝을 지우면 경비가 줄어 세금을 더 낸다.** 그래서 짝이
    하나로 확정될 때만 자동 제외하고, 애매하면 사용자에게 넘긴다.

    1순위: 승인번호가 정확히 하나 일치.
      실측: IBK 150행·KB 6행 모두 승인번호가 100% 채워져 있고 전부 유니크였다.
      즉 이 두 카드사는 취소 전표에 **원 승인번호를 실어주지 않는다** —
      취소 행도 자기 고유 번호를 받는다. 그래서 이 경로는 사실상 안 걸리고,
      원 번호를 실어주는 카드사를 위해 남겨둔다.

    2순위 폴백: 같은 상호 + 같은 절대금액 + PAIR_WINDOW_DAYS 이내.
      후보가 정확히 1건일 때만 제외한다.

    후보가 2건 이상이면 어느 것을 취소한 것인지 문자열만으로 결정할 수 없다.
    실측: 같은 상호+같은 금액 정상결제가 2건 이상인 조합이 20개 있었다
    (버스요금 5,000원 8건 등). 이때는 아무것도 지우지 않고 후보 전체에
    needs_review 를 세워 되묻기로 보낸다.
    """
    originals = [r for r in records if not r.is_cancel]
    cancels = [r for r in records if r.is_cancel]
    used: set = set()
    flagged: dict = {}

    # 합산 행은 카드사가 여러 건을 묶어 한 줄로 준 것이라 개별 취소 대상이
    # 될 수 없다. 폴백 후보에서 빼면 위험 조합이 줄고 불필요한
    # needs_review 도 생기지 않는다.
    pairable = [o for o in originals if not AGGREGATED_RE.match(o.merchant)]

    # 금액이 있는 행만 센다. 팀원 목록은 금액이 없어서 (상호, "") 로 뭉쳐
    # 위험 조합 수를 부풀린다 — 애초에 취소 페어링 대상이 아니다.
    def has_amt(r):
        return isinstance(r.amount, int)

    combo_all: Counter = Counter((o.merchant, o.amount) for o in originals if has_amt(o))
    combo_pairable: Counter = Counter((o.merchant, o.amount) for o in pairable if has_amt(o))
    st.risky_combos_all = sum(1 for v in combo_all.values() if v >= 2)
    st.risky_combos_pairable = sum(1 for v in combo_pairable.values() if v >= 2)

    for c in cancels:
        st.cancelled += 1
        mate, how = None, ""

        if AGGREGATED_RE.match(c.merchant):
            # 합산 행의 취소는 짝지을 개별 결제가 존재하지 않는다.
            st.unpaired_cancels += 1
            st.unpaired_log.append((c.merchant, c.amount,
                                    "합산 행 — 개별 취소 대상이 없다"))
            continue

        if c.approval_no:
            hits = [o for o in pairable
                    if id(o) not in used and o.approval_no == c.approval_no]
            if len(hits) == 1:
                mate, how = hits[0], "승인번호"

        cands = []
        if mate is None:
            cands = [o for o in pairable
                     if id(o) not in used
                     and o.merchant == c.merchant
                     and o.amount is not None and c.amount is not None
                     and abs(o.amount) == abs(c.amount)]
            if isinstance(c.when, date):
                cands = [o for o in cands
                         if isinstance(o.when, date)
                         and abs((c.when - o.when).days) <= PAIR_WINDOW_DAYS]
            if len(cands) == 1:
                mate, how = cands[0], "상호+금액+날짜"

        if mate is not None:
            used.add(id(mate))
            st.paired_originals += 1
            st.pair_log.append((c.merchant, c.amount, how))
        elif len(cands) >= 2:
            # 취소 대상 불확정. 틀린 짝을 지우는 것보다 사용자에게 묻는 게 낫다.
            st.ambiguous_cancels += 1
            st.ambiguous_log.append((c.merchant, c.amount, len(cands)))
            for o in cands:
                flagged[id(o)] = ("취소 대상 불확정 — 같은 상호·금액 결제가 %d건이라 "
                                  "어느 건이 취소됐는지 자동 판정 불가" % len(cands))
        else:
            st.unpaired_cancels += 1
            st.unpaired_log.append((
                c.merchant, c.amount,
                "짝 후보 없음 — 원 결제가 조회 기간 밖일 수 있다"))

    kept = [o for o in originals if id(o) not in used]
    for o in kept:
        if id(o) in flagged:
            o["needs_review"] = True
            o["review_reason"] = flagged[id(o)]
            st.review_flagged += 1
    return kept


def keeps_row(r: Record) -> bool:
    """to_rows 가 이 레코드를 출력할지. 충돌 검사에서 행을 맞추는 데 쓴다."""
    if NON_TRANSACTION_RE.match(r.merchant) and not r.biz_no:
        return False
    return r.amount is not None


# ---------------------------------------------------------------- 공통 후처리
def to_rows(records: list, st: Stats, norm=None) -> list:
    """출력 스키마로 변환한다. 여기서 PII(승인번호·날짜)를 버린다."""
    rows = []
    for r in records:
        merchant, biz_no, memo = r.merchant, r.biz_no, r.memo

        if NON_TRANSACTION_RE.match(merchant) and not biz_no:
            st.non_transaction += 1
            st.non_transaction_samples[merchant] += 1
            continue
        if r.amount is None:
            st.no_amount += 1
            continue

        aggregated = bool(AGGREGATED_RE.match(merchant))
        if aggregated:
            st.aggregated += 1
            st.aggregated_samples[merchant] += 1

        branch = branch_raw = ""
        if norm is not None:
            nr = norm.normalize(merchant, biz_no)
            branch, branch_raw = nr.branch, nr.branch_raw

        if MEDICAL_RE.search(merchant):
            merchant = st.mask_medical(merchant, biz_no)
            biz_no = ""      # 사업자번호가 남으면 어느 병원인지 역추적된다
            memo = ""
            branch = branch_raw = ""   # 지점명은 생활권 정보다

        approved_at = r.when.isoformat() if isinstance(r.when, date) else ""
        if not approved_at:
            st.no_date += 1

        # 키는 마스킹 전 원본 상호명으로 만든다 (재파싱 안정성)
        nkey = natural_key(approved_at, r.merchant, r.amount, r.approval_no)

        st.kept += 1
        st.per_card[r.source] += 1
        if not nkey:
            st.no_natural_key += 1
        rows.append({
            "approved_at": approved_at,
            "installment_months": r.get("installment", 0),
            "approval_no": r.approval_no,
            "natural_key": nkey,
            "raw_merchant": merchant,
            "amount": r.amount,
            "biz_no": biz_no,
            "memo": memo,
            "source_card": r.source,
            "is_aggregated": "true" if aggregated else "",
            "branch": branch,
            "branch_raw": branch_raw,
            "needs_review": "true" if r.get("needs_review") else "",
            "review_reason": r.get("review_reason", ""),
        })
    return rows


def check_natural_keys(records: list, rows: list, st: Stats) -> None:
    """natural_key 충돌을 찾아 '실제 중복' 과 '별개 거래' 로 가른다.

    natural_key = hash(날짜 + 상호 + 금액) 이므로, 같은 날 같은 가맹점에서
    같은 금액을 두 번 결제하면(버스요금 등) 키가 겹친다. 이건 설계 한계다.
    다만 승인번호는 거래마다 유니크하므로, 그것으로 둘을 가를 수 있다.
      승인번호가 같다 -> 같은 거래가 두 번 들어온 것 (실제 중복)
      승인번호가 다르다 -> 별개 거래인데 키가 겹친 것 (설계 한계)
    **자동 병합하지 않는다.** 보고만 한다.
    """
    by_key: dict = {}
    for r, row in zip(records, rows):
        if row["natural_key"]:
            by_key.setdefault(row["natural_key"], []).append((r, row))

    for key, group in by_key.items():
        if len(group) < 2:
            continue
        approvals = {r.approval_no for r, _ in group}
        files = {r.get("src_file", "") for r, _ in group}
        scope = "파일 간" if len(files) > 1 else "파일 내"
        item = (key, group[0][1]["raw_merchant"], group[0][1]["amount"],
                group[0][1]["approved_at"], len(group), scope, sorted(files))
        if len(approvals) == 1:
            st.dup_real.append(item)
        else:
            st.dup_distinct.append(item + (sorted(approvals),))


def read_file(path: Path, st: Stats, card_type: str | None = None) -> tuple:
    """한 파일을 읽어 (records, 판별결과, 경고) 를 돌려준다."""
    detected = detect_format(path)
    warn = ""
    used = card_type or detected
    if card_type and detected != "unknown" and card_type != detected:
        # IBK 와 KB 가 같은 .xls 확장자인데 물리 형식이 다르다.
        # 사용자가 드롭다운에서 잘못 고르면 여기서 잡힌다.
        warn = ("지정한 카드사(%s)와 파일 형식 판별 결과(%s)가 다릅니다. "
                "지정값으로 읽습니다 — 파싱이 실패하면 카드사를 다시 확인하세요."
                % (card_type.upper(), detected.upper()))
    adapter = get_adapter(used)
    if adapter is None:
        return [], used, "형식 판별 실패 — 건너뜁니다"

    # 승인내역인지 확인한다. 청구내역은 상호명을 쓸 수 없어 파싱을 거부한다.
    if hasattr(adapter, "headers"):
        kind, why = classify_statement(adapter.headers(path))
        st.statement_kinds.append((path.name, kind, why))
        if kind != "승인내역":
            st.blocked_files.append((path.name, kind, why))
            msg = "%s 로 판별됨 (%s)" % (kind, why)
            return [], used, msg + chr(10) + "     " + STATEMENT_GUIDE
    return adapter.read(path, st), used, warn
