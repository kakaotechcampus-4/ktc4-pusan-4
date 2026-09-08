import json
from pathlib import Path

import pytest

from pipeline.parse import parse_law

FIXTURE = Path(__file__).parent / "fixtures" / "law_001565.json"


def _payload():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))["법령"]


@pytest.fixture(scope="module")
def units():
    return {u.statute_id: u for u in parse_law(_payload())}


def test_skips_headings_and_deleted(units):
    assert "소득세법-13" not in units
    assert not any("제1장" in u.body for u in units.values())


def test_reassembly(units):
    jo = units["소득세법-33"]
    assert jo.unit_level == "조"
    assert len(jo.body) > 1000
    assert jo.meta["조문제목"] == "필요경비 불산입"


def test_proviso(units):
    assert "다만," in units["소득세법-33"].body
    assert "다만," in units["소득세법-33-1"].body


def test_ho_level(units):
    assert units["소득세법-33-1-2"].body.startswith("2. 벌금")
    assert units["소득세법-33-1-2"].unit_level == "호"


def test_ho_branch_number(units):
    assert units["소득세법-17-1-2의2"].body.startswith("2의2.")


def test_mok_folded_into_ho(units):
    body = units["소득세법-4-1-1"].body
    assert "가. 이자소득" in body
    assert "바. 기타소득" in body
    assert "소득세법-4-1-1-가" not in units


def test_unnumbered_hang(units):
    assert "소득세법-12-1-3" in units


def test_article_branch_number(units):
    assert "소득세법-33의2" in units


def test_metadata(units):
    jo = units["소득세법-33"]
    assert (jo.doc_id, jo.hierarchy, jo.doc_type) == ("001565", "법률", "법령")
    assert jo.effective_from.year >= 2025
    assert jo.source_url.endswith("/제33조")


def test_no_empty_rows(units):
    assert all(u.body.strip() for u in units.values())
    assert "소득세법-143의7-1" not in units


def test_ids_unique(units):
    assert len(parse_law(_payload())) == len(units)
