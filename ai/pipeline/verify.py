#!/usr/bin/env python
"""적재된 법령 코퍼스 검증. 하나라도 깨지면 exit 1.

사용: python -m pipeline.verify
"""

from __future__ import annotations

import contextlib
import sys

import psycopg

from app.config import settings

with contextlib.suppress(Exception):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# 판정 6관문에 직결되는 조문. 이게 없으면 코퍼스가 쓸모없다.
GOLDEN = [
    "소득세법-27",  # 사업소득의 필요경비의 계산
    "소득세법-33",  # 필요경비 불산입
    "소득세법-33-1-5",  # 가사 관련 경비
    "소득세법-160의2",  # 경비 등의 지출증명 수취 및 보관
    "소득세법시행령-55",  # 사업소득의 필요경비의 계산
    "소득세법시행령-61",  # 가사관련비등
    "소득세법시행령-67",  # 즉시상각의 의제
]

CHECKS = [
    (
        "현행 행 중복",
        """SELECT statute_id FROM statute_version
            WHERE effective_to IS NULL GROUP BY 1 HAVING count(*) > 1""",
    ),
    (
        "효력기간 겹침",
        """SELECT a.statute_id FROM statute_version a
             JOIN statute_version b ON a.statute_id = b.statute_id AND a.id < b.id
            WHERE a.effective_from < COALESCE(b.effective_to, '9999-12-31')
              AND b.effective_from < COALESCE(a.effective_to, '9999-12-31')""",
    ),
    (
        "빈 본문",
        """SELECT statute_id FROM statute_version WHERE length(trim(body)) < 5""",
    ),
    (
        "삭제 조문 잔존",
        r"""SELECT statute_id FROM statute_version WHERE body ~ '^\S{1,8}\s*삭제'""",
    ),
    (
        "편장절 제목 혼입",
        """SELECT statute_id FROM statute_version WHERE body LIKE '%제1장 총칙%'""",
    ),
]


def main() -> int:
    failed = 0
    with psycopg.connect(settings.database_url) as conn:
        for name, sql in CHECKS:
            bad = [r[0] for r in conn.execute(sql).fetchall()]
            if bad:
                failed += 1
                print(f"FAIL {name}: {len(bad)}건 — {bad[:5]}")
            else:
                print(f"ok   {name}")

        rows = {
            r[0]: r[1]
            for r in conn.execute(
                "SELECT statute_id, body FROM statute_version"
                " WHERE statute_id = ANY(%s) AND effective_to IS NULL",
                (GOLDEN,),
            ).fetchall()
        }
        missing = [s for s in GOLDEN if s not in rows]
        if missing:
            failed += 1
            print(f"FAIL 골든 조문 누락: {missing}")
        else:
            print(f"ok   골든 조문 {len(GOLDEN)}건")

        # 재조립이 실패하면 제33조가 조문제목 14자로 남는다
        jo33 = rows.get("소득세법-33", "")
        if len(jo33) < 1000 or "다만," not in jo33:
            failed += 1
            print(f"FAIL 조문 재조립: 소득세법-33 len={len(jo33)} 단서={'다만,' in jo33}")
        else:
            print("ok   조문 재조립")

        for row in conn.execute(
            "SELECT hierarchy, unit_level, count(*) FROM statute_version"
            " WHERE effective_to IS NULL GROUP BY 1, 2 ORDER BY 1, 2"
        ).fetchall():
            print(f"     {row[0]:<8} {row[1]:<4} {row[2]:6d}")

    print("\n실패 없음" if not failed else f"\n{failed}개 검사 실패")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
