#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
카드 이용내역 .xls 파서 (IBK형 / KB형 자동 판별).

같은 .xls 확장자인데 실체가 둘이다. 매직바이트로 가른다.
  '<html'         -> IBK형. 실제로는 HTML 표.
                     pandas.read_html 은 colspan="5.5" 에서 죽으므로
                     BeautifulSoup(lxml) 으로 tr/td 를 직접 읽는다.
  D0CF11E0A1B11AE1 -> KB형. 진짜 바이너리 xls(CDFV2). xlrd 로 읽는다.

사용:
    python tools/parse_card_xls.py                     # data/*.xls 전부 -> data/sample.csv
    python tools/parse_card_xls.py data/kb_card_raw.xls -o data/sample.csv

출력: raw_merchant, amount, biz_no, memo, source_card
  카드번호·승인번호·승인일시·고객명·카드명은 읽더라도 버린다 (PII).
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

try:
    from bs4 import BeautifulSoup
except ImportError:  # pragma: no cover
    sys.exit("beautifulsoup4 / lxml 이 필요합니다:  pip install beautifulsoup4 lxml")

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = ROOT / "data" / "sample.csv"
OUT_FIELDS = ["raw_merchant", "amount", "biz_no", "memo", "source_card"]

MAGIC_OLE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"

# ---------------------------------------------------------------- IBK형 (HTML)
IBK_COL = {
    "no": 0,
    "승인구분": 1,
    "이용구분": 2,
    "승인일시": 3,          # 버림
    "카드번호": 4,          # 버림
    "이용가맹점명": 5,
    "승인금액": 6,
    "제휴카드명": 7,        # 버림
    "승인번호": 8,          # 버림
    "매출표접수일자": 9,    # 버림
    "가맹점사업자번호": 10,
}
IBK_MIN_TD = 11

# ---------------------------------------------------------------- KB형 (xlrd)
KB_HEADER_ROW = 6
KB_COL = {
    "이용일": 0,            # 버림
    "이용시간": 1,          # 버림
    "이용고객명": 2,        # 버림
    "이용카드명": 3,        # 버림
    "이용하신곳": 4,
    "국내이용금액": 5,
    "해외이용금액": 6,
    "결제방법": 7,
    "가맹점정보": 8,
    "할인금액": 9,
    "적립포인트": 10,
    "상태": 11,
    "결제예정일": 12,       # 버림
    "승인번호": 13,         # 버림
    "메모": 14,             # ★ 헤더가 비어있는 사용자 메모. 상품명이 여기 있다.
}

# ---------------------------------------------------------------- 공통 규칙
# 할인 행은 사업자번호가 없다. biz_no 없음 AND 상호가 '할인'으로 끝남 -> 제외.
# ('○○할인마트'는 biz_no 가 있으므로 걸리지 않는다)
DISCOUNT_TAIL_RE = re.compile(r"할인$")
CANCEL_RE = re.compile(r"취소")

MEDICAL_RE = re.compile(r"(병원|의원|약국|한의원|치과|의료원|보건소)")
MEDICAL_PREFIX = "의료_마스킹"

BIZNO_RE = re.compile(r"^\d{3}-?\d{2}-?\d{5}$")


def parse_amount(text) -> int | None:
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


def detect_format(path: Path) -> str:
    head = path.open("rb").read(8)
    if head.startswith(MAGIC_OLE):
        return "kb"
    if head.lstrip()[:5].lower() == b"<html":
        return "ibk"
    return "unknown"


# ---------------------------------------------------------------- 통계
class Stats:
    def __init__(self) -> None:
        self.total = 0
        self.cancelled = 0
        self.discount = 0
        self.no_amount = 0
        self.foreign_ccy = 0
        self.kept = 0
        self.per_card: dict[str, int] = {}
        self.cancel_samples: list[str] = []
        self.discount_samples: list[str] = []
        # 의료 마스킹: 원본 식별자 -> 의료_마스킹_NN (같은 병원은 같은 번호)
        self.medical_map: dict[str, str] = {}

    def mask_medical(self, merchant: str, biz_no: str) -> str:
        key = biz_no or merchant
        if key not in self.medical_map:
            self.medical_map[key] = "%s_%02d" % (MEDICAL_PREFIX, len(self.medical_map) + 1)
        return self.medical_map[key]


def make_row(st: Stats, merchant: str, amount: int, biz_no: str, memo: str, card: str) -> dict:
    if MEDICAL_RE.search(merchant):
        merchant = st.mask_medical(merchant, biz_no)
        biz_no = ""   # 사업자번호가 남으면 어느 병원인지 역추적된다
        memo = ""
    st.kept += 1
    st.per_card[card] = st.per_card.get(card, 0) + 1
    return {
        "raw_merchant": merchant,
        "amount": amount,
        "biz_no": biz_no,
        "memo": memo,
        "source_card": card,
    }


def skip_common(st: Stats, merchant: str, biz_no: str, status_fields: list[str], amt_text: str) -> bool:
    """할인·취소 행을 걸러낸다. True 면 버린다."""
    if not biz_no and DISCOUNT_TAIL_RE.search(merchant):
        st.discount += 1
        if len(st.discount_samples) < 5:
            st.discount_samples.append(merchant)
        return True
    if any(CANCEL_RE.search(s) for s in status_fields):
        st.cancelled += 1
        if len(st.cancel_samples) < 10:
            st.cancel_samples.append("%s %s" % (merchant, amt_text))
        return True
    return False


# ---------------------------------------------------------------- IBK형 파서
def extract_ibk(path: Path, st: Stats) -> list[dict]:
    html = path.read_text(encoding="utf-8", errors="replace")
    soup = BeautifulSoup(html, "lxml")
    out = []
    for tr in soup.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) < IBK_MIN_TD:
            continue
        cells = [td.get_text(" ", strip=True) for td in tds]
        if not cells[IBK_COL["no"]].isdigit():   # 데이터 행: td 11개 이상 + 첫 셀 숫자
            continue

        st.total += 1
        merchant = cells[IBK_COL["이용가맹점명"]].strip()
        biz_no = norm_bizno(cells[IBK_COL["가맹점사업자번호"]])
        amt_text = cells[IBK_COL["승인금액"]].strip()

        if skip_common(
            st, merchant, biz_no,
            [cells[IBK_COL["승인구분"]], cells[IBK_COL["이용구분"]]],
            amt_text,
        ):
            continue

        amount = parse_amount(amt_text)
        if amount is None:
            st.no_amount += 1
            continue

        out.append(make_row(st, merchant, amount, biz_no, "", "ibk"))
    return out


# ---------------------------------------------------------------- KB형 파서
def extract_kb(path: Path, st: Stats) -> list[dict]:
    try:
        import xlrd
    except ImportError:  # pragma: no cover
        sys.exit("KB형(.xls 바이너리) 을 읽으려면 xlrd 가 필요합니다:  pip install xlrd")

    book = xlrd.open_workbook(str(path))
    sheet = book.sheet_by_index(0)
    out = []
    for i in range(KB_HEADER_ROW + 1, sheet.nrows):   # 0~5행 요약, 6행 헤더
        cells = [c.value for c in sheet.row(i)]
        if len(cells) <= KB_COL["메모"]:
            cells = cells + [""] * (KB_COL["메모"] + 1 - len(cells))
        merchant = str(cells[KB_COL["이용하신곳"]]).strip()
        if not merchant:
            continue

        st.total += 1
        status = str(cells[KB_COL["상태"]]).strip()
        memo = str(cells[KB_COL["메모"]]).strip()
        biz_no = ""   # KB 파일에는 가맹점 사업자번호가 없다

        domestic = parse_amount(cells[KB_COL["국내이용금액"]]) or 0
        foreign = parse_amount(cells[KB_COL["해외이용금액"]]) or 0
        amt_text = "%s" % (domestic or foreign)

        if skip_common(st, merchant, biz_no, [status], amt_text):
            continue

        if domestic:
            amount = domestic
        elif foreign:
            # 외화 전용 행. 원화 환산액이 없어 금액을 그대로 옮기면 단위가 섞인다.
            st.foreign_ccy += 1
            continue
        else:
            st.no_amount += 1
            continue

        out.append(make_row(st, merchant, amount, biz_no, memo, "kb"))
    return out


# ---------------------------------------------------------------- main
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="*", help="카드 .xls 경로 (생략 시 data/*.xls)")
    ap.add_argument("-o", "--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()

    paths = [Path(p) for p in args.inputs] or sorted((ROOT / "data").glob("*.xls"))
    if not paths:
        sys.exit("입력 .xls 가 없습니다. data/ 에 카드 내역 파일을 넣어주세요.")

    st = Stats()
    rows: list[dict] = []
    for p in paths:
        fmt = detect_format(p)
        if fmt == "ibk":
            got = extract_ibk(p, st)
        elif fmt == "kb":
            got = extract_kb(p, st)
        else:
            print("%s: 형식 판별 실패 — 건너뜀" % p.name)
            continue
        print("%s: [%s형] %d건" % (p.name, fmt.upper(), len(got)))
        rows.extend(got)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=OUT_FIELDS)
        w.writeheader()
        w.writerows(rows)

    report(st, rows, out)
    return 0


def report(st: Stats, rows: list[dict], out: Path) -> None:
    uniq = len({r["raw_merchant"] for r in rows})
    with_bizno = sum(1 for r in rows if r["biz_no"])
    with_memo = sum(1 for r in rows if r["memo"])
    print()
    print("  === 이 샘플 기준 ===")
    print("  원본 행       %d" % st.total)
    print("  취소 제외     %d" % st.cancelled)
    print("  할인 제외     %d" % st.discount)
    print("  외화전용 제외 %d" % st.foreign_ccy)
    print("  금액 파싱실패 %d" % st.no_amount)
    print("  의료 마스킹   %d개 상호 (%s)" % (
        len(st.medical_map), ", ".join(sorted(st.medical_map.values())) or "-"))
    print("  기록          %d  (유니크 상호 %d)" % (st.kept, uniq))
    for card, n in sorted(st.per_card.items()):
        print("    - %-4s %d건" % (card, n))
    pct = (with_bizno / st.kept * 100) if st.kept else 0
    print("  사업자번호    %d/%d  (%.1f%%)" % (with_bizno, st.kept, pct))
    print("  memo 있음     %d건" % with_memo)
    print("  -> %s" % out)

    if st.discount_samples:
        print("\n  할인 제외 샘플: " + ", ".join(st.discount_samples))
    if st.cancel_samples:
        print("  취소 제외 목록:")
        for s in st.cancel_samples:
            print("    " + s)

    # 같은 상호인데 memo 가 갈리는 케이스 — 상호만으로는 상품을 구분할 수 없다는 증거
    by_merchant: dict[str, set] = {}
    for r in rows:
        by_merchant.setdefault(r["raw_merchant"], set()).add(r["memo"])
    split = {m: v for m, v in by_merchant.items() if len([x for x in v if x]) > 1}
    if split:
        print("\n  같은 상호 / 다른 memo:")
        for m, v in sorted(split.items()):
            print("    %s -> %s" % (m, ", ".join(sorted(x for x in v if x))))

    print("\n  ※ 위 수치는 현재 data/ 에 있는 파일만 기준이다.")
    print("     취소 제외로 사라진 가맹점이 있을 수 있으므로(예: 쿠팡),")
    print("     시드 사전은 이 샘플만으로 채우지 않는다.")


if __name__ == "__main__":
    sys.exit(main())
