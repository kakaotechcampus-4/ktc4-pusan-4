#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
팀원 목록 어댑터 — 가맹점명 한 컬럼짜리 텍스트.

금액·날짜·사업자번호가 없다. 취소 페어링도 불가능하다
(취소 여부를 알 방법이 없다).
"""

from __future__ import annotations

from pathlib import Path

from . import Stats, make_record

SOURCE = "teammate"


def read(path: Path, st: Stats) -> list:
    out = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        merchant = line.strip()
        if not merchant or merchant.startswith("#"):
            continue
        st.total += 1
        out.append(make_record(merchant=merchant, amount="", source=SOURCE))
    return out
