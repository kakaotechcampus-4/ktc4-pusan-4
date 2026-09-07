#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
IBK형 어댑터 — 확장자만 .xls 이고 실제 내용은 HTML 표다.

pandas.read_html 은 이 파일의 colspan="5.5" 에서 죽으므로
BeautifulSoup(lxml) 으로 tr/td 를 직접 읽는다.

데이터 행 판별: td 11개 이상 + 첫 셀이 숫자.
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from bs4 import BeautifulSoup
except ImportError:  # pragma: no cover
    sys.exit("beautifulsoup4 / lxml 이 필요합니다:  pip install beautifulsoup4 lxml")

from . import (Stats, make_record, norm_bizno, parse_amount, parse_date,
               parse_installment)

SOURCE = "ibk"

COL = {
    "no": 0,
    "승인구분": 1,
    "이용구분": 2,
    "승인일시": 3,          # 페어링에만 쓰고 출력하지 않는다
    "카드번호": 4,          # 읽지 않는다
    "이용가맹점명": 5,
    "승인금액": 6,
    "제휴카드명": 7,        # 읽지 않는다
    "승인번호": 8,          # 페어링에만 쓰고 출력하지 않는다
    "매출표접수일자": 9,
    "가맹점사업자번호": 10,
}
MIN_TD = 11

# 이 카드사는 취소를 음수 금액으로 주지 않는다.
# 승인구분에 '취소또는할인' 이라고 적고 금액은 양수로 둔다.
CANCEL_MARK = "취소"


def headers(path: Path) -> list:
    """헤더 행의 th 텍스트. 승인내역/청구내역 판별에 쓴다."""
    soup = BeautifulSoup(path.read_text(encoding="utf-8", errors="replace"), "lxml")
    best: list = []
    for tr in soup.find_all("tr"):
        ths = [th.get_text(" ", strip=True) for th in tr.find_all("th")]
        if len(ths) > len(best):
            best = ths
    return best


def read(path: Path, st: Stats) -> list:
    html = path.read_text(encoding="utf-8", errors="replace")
    soup = BeautifulSoup(html, "lxml")
    out = []
    for tr in soup.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) < MIN_TD:
            continue
        cells = [td.get_text(" ", strip=True) for td in tds]
        if not cells[COL["no"]].isdigit():
            continue
        st.total += 1
        approval = cells[COL["승인구분"]]
        usage = cells[COL["이용구분"]]
        out.append(make_record(
            merchant=cells[COL["이용가맹점명"]],
            amount=parse_amount(cells[COL["승인금액"]]),
            biz_no=norm_bizno(cells[COL["가맹점사업자번호"]]),
            memo="",
            source=SOURCE,
            approval_no=cells[COL["승인번호"]],
            when=parse_date(cells[COL["승인일시"]]),   # 날짜만. 시간은 버린다
            # '국내체크일시불' / '국내일시불' -> 0, 'N개월' 표기가 있으면 그 값
            installment=parse_installment(usage),
            is_cancel=(CANCEL_MARK in approval or CANCEL_MARK in usage),
        ))
    return out
