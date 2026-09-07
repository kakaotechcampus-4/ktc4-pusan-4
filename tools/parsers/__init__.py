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
    raw_merchant, amount, biz_no, memo, source_card, is_aggregated, branch, branch_raw
"""

from __future__ import annotations

import re
import sys
from collections import Counter
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

OUT_FIELDS = ["raw_merchant", "amount", "biz_no", "memo", "source_card",
              "is_aggregated", "branch", "branch_raw"]

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
                when=None, is_cancel=False) -> Record:
    return Record(merchant=str(merchant).strip(), amount=amount, biz_no=biz_no,
                  memo=memo, source=source, approval_no=str(approval_no or "").strip(),
                  when=when, is_cancel=bool(is_cancel))


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
        self.foreign_ccy = 0
        self.aggregated = 0
        self.kept = 0
        self.per_card: Counter = Counter()
        self.non_transaction_samples: Counter = Counter()
        self.aggregated_samples: Counter = Counter()
        self.pair_log: list = []      # (상호, 금액, 매칭방법)
        self.unpaired_log: list = []  # (상호, 금액, 사유)
        self.medical_map: dict = {}

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

        st.kept += 1
        st.per_card[r.source] += 1
        rows.append({
            "raw_merchant": merchant,
            "amount": r.amount,
            "biz_no": biz_no,
            "memo": memo,
            "source_card": r.source,
            "is_aggregated": "true" if aggregated else "",
            "branch": branch,
            "branch_raw": branch_raw,
        })
    return rows


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
    return adapter.read(path, st), used, warn
