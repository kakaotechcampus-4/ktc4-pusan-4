"""statute_version -> legal_chunk 재색인.

법령 동기화와 단계를 나눈 이유는 실행 주기가 아니라 실패 격리다. 임베딩 API 가
죽어도 원문은 저장돼 있고 재색인만 다시 돌리면 된다. 청킹 전략을 바꿀 때도
법령 API 를 다시 부를 이유가 없다.

사용:
    python -m pipeline.reindex --incremental
    python -m pipeline.reindex --full --doc-type=심판례해석
"""

from __future__ import annotations

import argparse
import contextlib
import sys
from typing import Any

import psycopg
from psycopg.rows import dict_row

from app.config import settings
from pipeline.chunk import Chunk, chunk
from pipeline.embed import client, embed

with contextlib.suppress(Exception):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DOC_TYPES = ["법령", "행정규칙", "심판례해석", "판례"]

# 법령은 자식 행이 있는지 봐야 맨 아래 조항을 가려낼 수 있다. 바뀐 행만 떼어
# 오면 자식이 안 보여 조가 맨 아래로 오인된다. 그래서 늘 전량을 읽어 청킹하고,
# 임베딩만 바뀐 것에 건다. 25,495행 8MB 라 통째로 읽어도 부담이 없다.
NEEDS_SIBLINGS = ("법령", "행정규칙")

COLS = """id, statute_id, doc_id, doc_type, hierarchy,
          effective_from, effective_to, is_superseded, body, body_hash"""

_INSERT = """
INSERT INTO legal_chunk (
    statute_version_id, statute_id, doc_id, doc_type, hierarchy, section, seq,
    effective_from, effective_to, is_superseded, body, source_hash, embedding)
VALUES (
    %(statute_version_id)s, %(statute_id)s, %(doc_id)s, %(doc_type)s, %(hierarchy)s,
    %(section)s, %(seq)s, %(effective_from)s, %(effective_to)s, %(is_superseded)s,
    %(body)s, %(source_hash)s, %(embedding)s::vector)
"""

_STALE = """
SELECT sv.id FROM statute_version sv
 WHERE NOT EXISTS (
     SELECT 1 FROM legal_chunk lc
      WHERE lc.statute_version_id = sv.id AND lc.source_hash = sv.body_hash)
"""


def _fetch(conn: psycopg.Connection, doc_type: str | None) -> list[dict[str, Any]]:
    sql = f"SELECT {COLS} FROM statute_version"
    params: tuple = ()
    if doc_type:
        sql += " WHERE doc_type = %s"
        params = (doc_type,)
    return conn.execute(sql, params).fetchall()


def _row(c: Chunk, vector: list[float]) -> dict[str, Any]:
    return {**c.__dict__, "embedding": str(vector)}


def write(conn: psycopg.Connection, chunks: list[Chunk], batch: int = 100) -> int:
    """임베딩을 받아 적재한다. 같은 원문의 옛 청크는 지우고 새로 넣는다."""
    if not chunks:
        return 0
    api = client()
    done = 0
    conn.execute(
        "DELETE FROM legal_chunk WHERE statute_version_id = ANY(%s)",
        ([c.statute_version_id for c in chunks],),
    )
    for i in range(0, len(chunks), batch):
        part = chunks[i : i + batch]
        vectors = embed([c.body for c in part], api)
        conn.cursor().executemany(_INSERT, [_row(c, v) for c, v in zip(part, vectors)])
        conn.commit()
        done += len(part)
        print(f"  {done:,}/{len(chunks):,}", flush=True)
    return done


def collect(conn: psycopg.Connection, doc_type: str | None, incremental: bool) -> list[Chunk]:
    stale = {r["id"] for r in conn.execute(_STALE).fetchall()} if incremental else None

    chunks: list[Chunk] = []
    for kind in [doc_type] if doc_type else DOC_TYPES:
        rows = _fetch(conn, kind)
        if incremental and kind not in NEEDS_SIBLINGS:
            rows = [r for r in rows if r["id"] in stale]
        if not rows:
            continue
        made = chunk(rows)
        chunks += [c for c in made if stale is None or c.statute_version_id in stale]
    return chunks


def main() -> int:
    ap = argparse.ArgumentParser(description="법령 코퍼스 재색인")
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--incremental", action="store_true", help="원문이 바뀐 것만")
    mode.add_argument("--full", action="store_true", help="전량 재색인")
    ap.add_argument("--doc-type", choices=DOC_TYPES, help="생략하면 전부")
    ap.add_argument("--limit", type=int, metavar="N", help="최대 청크 수(시험용)")
    ap.add_argument("--dry-run", action="store_true", help="청크 수만 세고 임베딩은 안 부른다")
    args = ap.parse_args()

    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        if args.full:
            sql = "DELETE FROM legal_chunk"
            params: tuple = ()
            if args.doc_type:
                sql += " WHERE doc_type = %s"
                params = (args.doc_type,)
            conn.execute(sql, params)

        chunks = collect(conn, args.doc_type, args.incremental)
        if args.limit:
            chunks = chunks[: args.limit]

        total = sum(len(c.body) for c in chunks)
        print(f"청크 {len(chunks):,}개 · 본문 {total:,}자")
        if args.dry_run:
            conn.rollback()
            return 0

        write(conn, chunks)
        if args.incremental:
            conn.execute("UPDATE law_sync_log SET reindexed = true WHERE changed AND NOT reindexed")
        conn.commit()

    print("완료")
    return 0


if __name__ == "__main__":
    sys.exit(main())
