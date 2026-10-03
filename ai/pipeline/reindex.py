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
import hashlib
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
 WHERE sv.doc_type = %s AND sv.effective_to IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM legal_chunk lc
      WHERE lc.statute_version_id = sv.id AND lc.source_hash = sv.body_hash)
"""

# law_sync 가 옛 행을 닫아도 body_hash 는 그대로라 청크가 현행으로 남는다
_SYNC = """
UPDATE legal_chunk lc SET effective_to = sv.effective_to, is_superseded = sv.is_superseded
  FROM statute_version sv
 WHERE lc.statute_version_id = sv.id
   AND (lc.effective_to, lc.is_superseded) IS DISTINCT FROM (sv.effective_to, sv.is_superseded)
"""

_STORED = """
SELECT lc.statute_version_id, lc.section, lc.seq, md5(lc.body) AS md5
  FROM legal_chunk lc JOIN statute_version sv ON sv.id = lc.statute_version_id
 WHERE lc.doc_type = %s AND sv.effective_to IS NULL
"""


def _fetch(conn: psycopg.Connection, doc_type: str, ids: set[int] | None = None) -> list[dict]:
    sql = f"SELECT {COLS} FROM statute_version WHERE doc_type = %s AND effective_to IS NULL"
    if ids is None:
        return conn.execute(sql, (doc_type,)).fetchall()
    return conn.execute(sql + " AND id = ANY(%s)", (doc_type, list(ids))).fetchall()


def stale(made: list[Chunk], stored: list[dict]) -> set[int]:
    """청크 본문이 하나라도 달라진 원문 행. 부모 문구만 바뀐 호, 잎에서 빠진 조도 잡힌다."""
    new: dict[int, dict] = {}
    old: dict[int, dict] = {}
    for c in made:
        new.setdefault(c.statute_version_id, {})[c.section, c.seq] = (
            hashlib.md5(c.body.encode()).hexdigest()
        )
    for r in stored:
        old.setdefault(r["statute_version_id"], {})[r["section"], r["seq"]] = r["md5"]
    return {i for i in new.keys() | old.keys() if new.get(i) != old.get(i)}


def _row(c: Chunk, vector: list[float]) -> dict[str, Any]:
    return {**c.__dict__, "embedding": str(vector)}


def write(conn: psycopg.Connection, chunks: list[Chunk], ids: set[int], batch: int = 100) -> int:
    """ids 의 옛 청크를 지우고 chunks 를 임베딩해 넣는다."""
    conn.execute("DELETE FROM legal_chunk WHERE statute_version_id = ANY(%s)", (list(ids),))
    if not chunks:
        return 0
    api = client()
    done = 0
    for i in range(0, len(chunks), batch):
        part = chunks[i : i + batch]
        vectors = embed([c.body for c in part], api)
        conn.cursor().executemany(_INSERT, [_row(c, v) for c, v in zip(part, vectors)])
        conn.commit()
        done += len(part)
        print(f"  {done:,}/{len(chunks):,}", flush=True)
    return done


def collect(
    conn: psycopg.Connection, doc_type: str | None, incremental: bool
) -> tuple[list[Chunk], set[int]]:
    """다시 넣을 청크와, 옛 청크를 지울 원문 행 id."""
    chunks: list[Chunk] = []
    ids: set[int] = set()
    for kind in [doc_type] if doc_type else DOC_TYPES:
        if not incremental:
            made = chunk(_fetch(conn, kind))
            ids |= {c.statute_version_id for c in made}
        elif kind in NEEDS_SIBLINGS:
            made = chunk(_fetch(conn, kind))
            changed = stale(made, conn.execute(_STORED, (kind,)).fetchall())
            made = [c for c in made if c.statute_version_id in changed]
            ids |= changed
        else:
            # 심판례는 162MB 라 전량을 읽지 않는다. 불변 문서라 새 행만 보면 된다
            new = {r["id"] for r in conn.execute(_STALE, (kind,)).fetchall()}
            made = chunk(_fetch(conn, kind, new)) if new else []
            ids |= new
        chunks += made
    return chunks, ids


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
        else:
            n = conn.execute(_SYNC).rowcount
            print(f"닫힌 원문 반영 {n:,}청크")

        chunks, ids = collect(conn, args.doc_type, args.incremental)
        if args.limit:
            chunks = chunks[: args.limit]
            ids = {c.statute_version_id for c in chunks}

        total = sum(len(c.body) for c in chunks)
        print(f"원문 {len(ids):,}행 · 청크 {len(chunks):,}개 · 본문 {total:,}자")
        if args.dry_run:
            conn.rollback()
            return 0

        write(conn, chunks, ids)
        if args.incremental:
            conn.execute("UPDATE law_sync_log SET reindexed = true WHERE changed AND NOT reindexed")
        conn.commit()

    print("완료")
    return 0


if __name__ == "__main__":
    sys.exit(main())
