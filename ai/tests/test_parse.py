import json
from pathlib import Path

import pytest

from pipeline.parse import parse_admrul, parse_decc, parse_expc, parse_law, parse_prec

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


def _fx(name):
    data = json.loads((Path(__file__).parent / "fixtures" / f"{name}.json").read_text(encoding="utf-8"))
    return data["payload"], data["row"]


def test_admrul_splits_articles():
    units = {u.statute_id: u for u in parse_admrul(_fx("admrul")[0])}
    assert units["2025년귀속경비율고시#37081-4"].unit_level == "조"
    assert "940" in units["2025년귀속경비율고시#37081-4"].body
    assert all(u.hierarchy == "고시" for u in units.values())


def test_admrul_id_includes_doc_id():
    """행정규칙명은 유일하지 않다. 이름만 쓰면 서로 다른 고시가 서로를 덮어쓴다."""
    units = parse_admrul(_fx("admrul")[0])
    assert all("#37081-" in u.statute_id for u in units)


def test_admrul_strips_img_tags():
    units = {u.statute_id: u for u in parse_admrul(_fx("admrul")[0])}
    assert "<img" not in units["2025년귀속경비율고시#37081-3"].body


def test_expc_joins_sections():
    payload, row = _fx("expc")
    (u,) = parse_expc(payload, row)
    assert u.unit_level == "문서"
    assert u.hierarchy == "해석례"
    assert u.statute_id.startswith("해석례-")
    assert len(u.body) > 200


def test_decc_merges_list_row():
    payload, row = _fx("decc")
    (u,) = parse_decc(payload, row)
    # 본문 응답의 청구번호는 빈 문자열이라 목록에서 와야 한다
    assert not payload.get("청구번호")
    assert u.doc_no == row["청구번호"]
    assert u.meta["세목"]


def test_prec_drops_parties():
    payload, row = _fx("prec")
    (u,) = parse_prec(payload, row)
    assert u.meta["본문절단"] is True
    assert "【원고" not in u.body
    assert "【원심판결】" not in u.body
    assert "【주" in u.body


def test_prec_falls_back_without_marker():
    payload, row = _fx("prec")
    payload = {**payload, "판례내용": "【원고, 상고인】 홍길동<br/>【원심판결】 서울고법"}
    (u,) = parse_prec(payload, row)
    assert u.meta["본문절단"] is False
    assert "홍길동" not in u.body


def test_dates_accept_both_formats():
    payload, row = _fx("decc")
    (u,) = parse_decc(payload, row)
    assert u.issued_at.year == 2014
