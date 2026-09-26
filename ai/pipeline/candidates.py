"""미판정 집계 -> 규칙 후보 -> rule_candidate 적재. 주 1회 배치.

CONTEXT.md 9.5 의 [1] 과 [6]. 가운데 셋(질의·근거 선택·초안)은 query·select·draft 가 한다.

사용:
    python -m pipeline.candidates --dry-run
    python -m pipeline.candidates --limit 10

집계는 기간을 안 자른다. 대신 이미 후보 행이 있는 (카테고리 × 업종)을 건너뛴다.
기간으로 자르면 주당 한두 건씩 쌓이는 카테고리가 영영 임계값을 못 넘고, 안 자르면
매주 같은 후보가 중복 적재된다. 승인된 건은 카드가 생겨 미판정이 멎으므로 자연히
빠지고, 기각된 건은 사람이 아니라고 했으니 다시 올리지 않는다.

distinct_users 는 조인으로만 나온다. unmatched_log 에 user_id 가 일부러 없다 —
규칙 후보 큐에 개인 지출 패턴이 드러나면 안 된다(CONTEXT.md 8). 집계 결과만 남기고
user_id 는 버린다.
"""

from __future__ import annotations

import argparse
import sys
from datetime import UTC, date, datetime

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Json

from app.config import settings
from pipeline.draft import draft, missing_statutes, render
from pipeline.query import NOT_APPLICABLE, category_meta, context, rewrite
from pipeline.search import TIERS, Hit, retrieve
from pipeline.select import Evidence, needs_review, select

REASON = "RULE_NOT_FOUND"

# 개인 특수사정을 거른다. 한 사람만 겪는 지출은 규칙이 아니다.
MIN_USERS = 2

_AGG = """
SELECT u.merchant_category, u.industry_code,
       count(*)                  AS occurrence_count,
       count(DISTINCT b.user_id) AS distinct_users
  FROM unmatched_log u
  JOIN judgment j     ON j.id = u.judgment_id
  JOIN transaction t  ON t.id = j.transaction_id
  JOIN upload_batch b ON b.id = t.batch_id
 WHERE u.reason = %(reason)s
   AND NOT EXISTS (SELECT 1 FROM rule_candidate c
                    WHERE c.merchant_category = u.merchant_category
                      AND c.industry_code = u.industry_code)
 GROUP BY u.merchant_category, u.industry_code
HAVING count(DISTINCT b.user_id) >= %(min_users)s
 ORDER BY occurrence_count DESC
 LIMIT %(limit)s
"""

_INSERT = """
INSERT INTO rule_candidate
       (merchant_category, industry_code, distinct_users, occurrence_count,
        suggested_docs, searched_tier, draft_yaml, status)
VALUES (%(merchant_category)s, %(industry_code)s, %(distinct_users)s, %(occurrence_count)s,
        %(suggested_docs)s, %(searched_tier)s, %(draft_yaml)s, %(status)s)
RETURNING id
"""


def aggregate(conn: psycopg.Connection, min_users: int, limit: int) -> list[dict]:
    return conn.execute(
        _AGG, {"reason": REASON, "min_users": min_users, "limit": limit}
    ).fetchall()


def top_tier(ev: Evidence, by_tier: dict[str, list[Hit]]) -> str | None:
    """인용이 나온 가장 위 위계. rule_candidate.searched_tier 가 위계 준수를 보는 값이다.

    딕트 키가 아니라 doc_type 으로 본다. '기본' 은 위계가 아니라 기본 조문 묶음이다.
    """
    tier_of = {h.statute_id: h.doc_type for hits in by_tier.values() for h in hits}
    used = {tier_of[r.statute_id] for r in ev.refs if r.statute_id in tier_of}
    return next((t for t in TIERS if t in used), None)


def docs(ev: Evidence, by_tier: dict[str, list[Hit]]) -> list[dict]:
    tier_of = {h.statute_id: h.doc_type for hits in by_tier.values() for h in hits}
    return [
        {"statute_id": r.statute_id, "quote": r.quote, "tier": tier_of.get(r.statute_id)}
        for r in ev.refs
    ]


def propose(
    conn: psycopg.Connection, row: dict, meta: dict, as_of: date, today: date
) -> tuple[dict, str]:
    """집계 한 줄을 rule_candidate 행으로. 실패해도 예외를 밖으로 안 내보낸다.

    한 후보가 깨졌다고 배치가 죽으면 나머지 후보도 다음 주까지 밀린다.
    깨진 건은 초안 없이 보류로 넣어 사람이 보게 한다.
    """
    cat, ind = row["merchant_category"], row["industry_code"]
    block = context(cat, ind, REASON, meta)
    out = dict(row) | {
        "suggested_docs": Json([]),
        "searched_tier": None,
        "draft_yaml": None,
        "status": "보류",
    }
    try:
        plan = rewrite(cat, ind, REASON, meta)
        by_tier = retrieve(conn, plan.queries, plan.keywords, as_of, NOT_APPLICABLE.get(ind, ()))
        ev = select(block, by_tier)
        card = draft(block, ev)
    except (ValueError, RuntimeError) as e:
        return out, f"에이전트 실패 — {e}"

    gone = missing_statutes(conn, [r.statute_id for r in ev.refs])
    hold = (
        ["근거 부족"] * (not ev.sufficient)
        + ["하위 근거만으로 확정"] * needs_review(ev, by_tier)
        + [f"현행에 없는 조문 {gone}"] * bool(gone)
    )
    out |= {
        "suggested_docs": Json(docs(ev, by_tier)),
        "searched_tier": top_tier(ev, by_tier),
        "draft_yaml": render(card, ev, cat, ind, today),
        "status": "보류" if hold else "대기",
    }
    return out, f"{card.gate}/{card.verdict or '-'} 근거 {len(ev.refs)}건" + (
        " · 보류: " + ", ".join(hold) if hold else ""
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="규칙 후보 추출")
    ap.add_argument("--limit", type=int, default=10, help="빈도 상위 N건")
    ap.add_argument("--min-users", type=int, default=MIN_USERS, help="서로 다른 사용자 수 하한")
    ap.add_argument("--dry-run", action="store_true", help="집계만 하고 적재하지 않는다")
    args = ap.parse_args()

    today = datetime.now(UTC).date()
    meta = category_meta()
    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        rows = aggregate(conn, args.min_users, args.limit)
        print(f"후보 {len(rows)}건 (reason={REASON}, distinct_users>={args.min_users})")
        for r in rows:
            print(f"  {r['merchant_category']}/{r['industry_code']}"
                  f"  {r['occurrence_count']}건 · {r['distinct_users']}명")
        if args.dry_run or not rows:
            conn.rollback()
            return 0

        for r in rows:
            params, why = propose(conn, r, meta, today, today)
            new_id = conn.execute(_INSERT, params).fetchone()["id"]
            print(f"  #{new_id} {r['merchant_category']} [{params['status']}] {why}")
        conn.commit()

    return 0


if __name__ == "__main__":
    sys.exit(main())
