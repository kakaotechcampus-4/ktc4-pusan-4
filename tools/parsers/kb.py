#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
KB형 어댑터 — 진짜 바이너리 xls(CDFV2). xlrd 로 읽는다.

0~5행은 요약 정보, 6행이 헤더, 7행부터 데이터다.
15번째 컬럼(인덱스 14)은 헤더가 비어 있는 사용자 메모다.
'Onedrive', 'Gemini', 'GPT' 처럼 실제 상품명이 여기 들어 있어서
한 상호(구글플레이)에 여러 상품이 섞이는 것을 구분할 유일한 단서다.
"""

from __future__ import annotations

import sys
from pathlib import Path

from . import Stats, make_record, parse_amount, parse_date

SOURCE = "kb"

HEADER_ROW = 6
COL = {
    "이용일": 0,            # 페어링에만 쓴다
    "이용시간": 1,
    "이용고객명": 2,        # 읽지 않는다 (PII)
    "이용카드명": 3,        # 읽지 않는다
    "이용하신곳": 4,
    "국내이용금액": 5,
    "해외이용금액": 6,
    "결제방법": 7,
    "가맹점정보": 8,
    "할인금액": 9,
    "적립포인트": 10,
    "상태": 11,
    "결제예정일": 12,
    "승인번호": 13,         # 페어링에만 쓰고 출력하지 않는다
    "메모": 14,             # 헤더 없는 사용자 메모
}

CANCEL_MARK = "취소"        # 상태 = '취소전표매입'


def headers(path: Path) -> list:
    """6행이 헤더다. 승인내역/청구내역 판별에 쓴다."""
    try:
        import xlrd
    except ImportError:  # pragma: no cover
        return []
    sheet = xlrd.open_workbook(str(path)).sheet_by_index(0)
    if sheet.nrows <= HEADER_ROW:
        return []
    return [str(c.value) for c in sheet.row(HEADER_ROW)]


def read(path: Path, st: Stats) -> list:
    try:
        import xlrd
    except ImportError:  # pragma: no cover
        sys.exit("KB형(.xls 바이너리) 을 읽으려면 xlrd 가 필요합니다:  pip install xlrd")

    sheet = xlrd.open_workbook(str(path)).sheet_by_index(0)
    out = []
    for i in range(HEADER_ROW + 1, sheet.nrows):
        cells = [c.value for c in sheet.row(i)]
        if len(cells) <= COL["메모"]:
            cells = cells + [""] * (COL["메모"] + 1 - len(cells))
        merchant = str(cells[COL["이용하신곳"]]).strip()
        if not merchant:
            continue
        st.total += 1

        domestic = parse_amount(cells[COL["국내이용금액"]]) or 0
        foreign = parse_amount(cells[COL["해외이용금액"]]) or 0
        if domestic:
            amount = domestic
        elif foreign:
            # 외화 전용 행. 원화 환산액이 없어 그대로 넣으면 단위가 섞인다.
            st.foreign_ccy += 1
            continue
        else:
            amount = None

        out.append(make_record(
            merchant=merchant,
            amount=amount,
            biz_no="",              # KB 파일에는 가맹점 사업자번호가 없다
            memo=str(cells[COL["메모"]]).strip(),
            source=SOURCE,
            approval_no=cells[COL["승인번호"]],
            when=parse_date(cells[COL["이용일"]]),
            is_cancel=(CANCEL_MARK in str(cells[COL["상태"]])),
        ))
    return out
