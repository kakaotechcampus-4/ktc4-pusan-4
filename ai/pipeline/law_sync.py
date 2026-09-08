#!/usr/bin/env python
"""법령 코퍼스 수집.

빈 DB에 돌리면 백필, 매일 돌리면 증분이다. 같은 코드다.

사용:
    python -m pipeline.law_sync
    python -m pipeline.law_sync --dry-run
    python -m pipeline.law_sync --law 001565
"""

from __future__ import annotations

import argparse
import contextlib
import sys

import psycopg
from psycopg.types.json import Json

from app.config import settings

from .lawapi import service
from .parse import Unit, parse_law

with contextlib.suppress(Exception):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

LAWS = [
    "001565",  # 소득세법
    "003956",  # 소득세법 시행령
    "007507",  # 소득세법 시행규칙
    "001571",  # 부가가치세법
    "003666",  # 부가가치세법 시행령
    "007289",  # 부가가치세법 시행규칙
    "001584",  # 조세특례제한법
    "004920",  # 조세특례제한법 시행령
    "008218",  # 조세특례제한법 시행규칙
    "001586",  # 국세기본법
    "002884",  # 국세기본법 시행령
    "006741",  # 국세기본법 시행규칙
]

_INSERT = """
INSERT INTO statute_version (
    statute_id, doc_type, doc_id, unit_level, hierarchy, title, doc_no,
    effective_from, issued_at, body, body_hash, source_url, meta)
VALUES (
    %(statute_id)s, %(doc_type)s, %(doc_id)s, %(unit_level)s, %(hierarchy)s,
    %(title)s, %(doc_no)s, %(effective_from)s, %(issued_at)s, %(body)s,
    %(body_hash)s, %(source_url)s, %(meta)s)
"""


def _row(u: Unit) -> dict:
    return {
        "statute_id": u.statute_id,
        "doc_type": u.doc_type,
        "doc_id": u.doc_id,
        "unit_level": u.unit_level,
        "hierarchy": u.hierarchy,
        "title": u.title,
        "doc_no": u.doc_no,
        "effective_from": u.effective_from,
        "issued_at": u.issued_at,
        "body": u.body,
        "body_hash": u.body_hash,
        "source_url": u.source_url,
        "meta": Json(u.meta),
    }


def upsert(conn: psycopg.Connection, u: Unit) -> bool:
    current = conn.execute(
        "SELECT id, body_hash, effective_from FROM statute_version"
        " WHERE statute_id = %s AND effective_to IS NULL",
        (u.statute_id,),
    ).fetchone()

    if current is None:
        conn.execute(_INSERT, _row(u))
        return True

    row_id, body_hash, effective_from = current
    if body_hash == u.body_hash:
        return False

    # 시행일이 같은데 본문이 다르면 개정이 아니라 원문 정정이다.
    # 옛 행을 닫으면 effective_to = effective_from 이 되어 CHECK 제약에 걸린다.
    if effective_from == u.effective_from:
        conn.execute(
            "UPDATE statute_version SET body = %s, body_hash = %s, fetched_at = now()"
            " WHERE id = %s",
            (u.body, u.body_hash, row_id),
        )
        return True

    conn.execute(
        "UPDATE statute_version SET effective_to = %s, is_superseded = true WHERE id = %s",
        (u.effective_from, row_id),
    )
    conn.execute(_INSERT, _row(u))
    return True


def main() -> int:
    ap = argparse.ArgumentParser(description="법령 코퍼스 수집")
    ap.add_argument("--law", action="append", metavar="법령ID", help="생략하면 LAWS 전체")
    ap.add_argument("--dry-run", action="store_true", help="변경 건수만 출력하고 롤백")
    args = ap.parse_args()

    law_ids = args.law or LAWS
    changed: list[str] = []

    with psycopg.connect(settings.database_url) as conn:
        for law_id in law_ids:
            units = parse_law(service(settings.law_api_oc, "law", ID=law_id))
            hits = [u.statute_id for u in units if upsert(conn, u)]
            changed += hits
            title = units[0].title if units else law_id
            print(f"{law_id} {title:<24} {len(units):5d}행  변경 {len(hits):5d}")

        conn.execute(
            "INSERT INTO law_sync_log (target_law, doc_type, changed, changed_statutes)"
            " VALUES (%s, '법령', %s, %s)",
            (",".join(law_ids), bool(changed), Json(changed[:200])),
        )

        if args.dry_run:
            conn.rollback()
            print(f"\ndry-run: {len(changed)}건 변경 예정. 롤백함")
        else:
            conn.commit()
            print(f"\n총 {len(changed)}건 변경")

    return 0


if __name__ == "__main__":
    sys.exit(main())
