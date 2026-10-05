import hashlib
import json
from pathlib import Path

import pytest

from pipeline.chunk import chunk_statutes
from pipeline.parse import parse_law
from pipeline.reindex import stale

FIXTURE = Path(__file__).parent / "fixtures" / "law_001565.json"


def _stored(chunks):
    return [
        {
            "statute_version_id": c.statute_version_id,
            "section": c.section,
            "seq": c.seq,
            "md5": hashlib.md5(c.body.encode()).hexdigest(),
        }
        for c in chunks
    ]


@pytest.fixture(scope="module")
def rows():
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))["법령"]
    return [
        {
            "id": i,
            "statute_id": u.statute_id,
            "doc_id": u.doc_id,
            "doc_type": u.doc_type,
            "hierarchy": u.hierarchy,
            "effective_from": u.effective_from,
            "effective_to": None,
            "is_superseded": False,
            "body": u.body,
            "body_hash": u.body_hash,
        }
        for i, u in enumerate(parse_law(payload))
    ]


def _id(rows, statute_id):
    return next(r["id"] for r in rows if r["statute_id"] == statute_id)


def _edit(rows, statute_id, body):
    return [{**r, "body": body} if r["statute_id"] == statute_id else r for r in rows]


def test_unchanged(rows):
    made = chunk_statutes(rows)
    assert stale(made, _stored(made)) == set()


def test_leaf_body_changed(rows):
    before = _stored(chunk_statutes(rows))
    after = chunk_statutes(_edit(rows, "소득세법-33-1-5", "5. 바뀐 문구"))
    assert stale(after, before) == {_id(rows, "소득세법-33-1-5")}


def test_parent_heading_changes_every_leaf(rows):
    # 호 본문은 그대로여도 청크 앞머리(조 제목·항 도입문)가 바뀐다
    before = _stored(chunk_statutes(rows))
    head = next(r["body"] for r in rows if r["statute_id"] == "소득세법-33")
    after = chunk_statutes(_edit(rows, "소득세법-33", "제33조(바뀐 제목)" + head[head.index("\n"):]))
    changed = stale(after, before)
    assert _id(rows, "소득세법-33-1-5") in changed
    other = next(c for c in after if not c.statute_id.startswith("소득세법-33"))
    assert other.statute_version_id not in changed


def test_dropped_leaf_and_new_row(rows):
    before = _stored(chunk_statutes(rows))
    gone = _id(rows, "소득세법-33-1-5")
    after = chunk_statutes(
        [r for r in rows if r["id"] != gone]
        + [{**rows[0], "id": 99999, "statute_id": "소득세법-33-1-99", "body": "99. 새 호"}]
    )
    assert stale(after, before) == {gone, 99999}
