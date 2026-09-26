import json
from datetime import date
from pathlib import Path

import pytest

from pipeline.chunk import chunk, chunk_case, chunk_statutes
from pipeline.parse import parse_law

FIXTURE = Path(__file__).parent / "fixtures" / "law_001565.json"


def _row(unit, row_id=0):
    return {
        "id": row_id,
        "statute_id": unit.statute_id,
        "doc_id": unit.doc_id,
        "doc_type": unit.doc_type,
        "hierarchy": unit.hierarchy,
        "effective_from": unit.effective_from,
        "effective_to": None,
        "is_superseded": False,
        "body": unit.body,
        "body_hash": unit.body_hash,
    }


@pytest.fixture(scope="module")
def chunks():
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))["법령"]
    rows = [_row(u, i) for i, u in enumerate(parse_law(payload))]
    return {c.statute_id: c for c in chunk_statutes(rows)}


def test_only_leaves_are_indexed(chunks):
    # 조·항은 호를 통째로 품고 있다. 셋 다 넣으면 같은 문장이 세 번 나온다.
    assert "소득세법-33" not in chunks
    assert "소득세법-33-1" not in chunks
    assert "소득세법-33-1-5" in chunks


def test_leaf_article_without_hang(chunks):
    assert chunks["소득세법-1"].body.startswith("제1조(목적)")


def test_lead_completes_the_sentence(chunks):
    body = chunks["소득세법-33-1-5"].body
    assert body.startswith("제33조(필요경비 불산입)")
    assert "다음 각 호에 해당하는 것은" in body
    assert body.endswith("가사(家事)의 경비와 이에 관련되는 경비")


def test_lead_skips_hang_that_starts_with_a_ho(chunks):
    # 제12조는 항내용이 없어 항 본문 첫 줄이 곧 1호다. 그게 접두로 붙으면 안 된다.
    body = chunks["소득세법-12-1-1"].body
    assert body.startswith("제12조(비과세소득)")
    assert body.count("「공익신탁법」") == 1


def test_sibling_ho_are_separate_chunks(chunks):
    # RC-007(9호 must_not)과 RC-008(13호 expect)이 한 청크에 들어가면 안 된다.
    assert "부가가치세의 매입세액" not in chunks["소득세법-33-1-13"].body
    assert "직접 그 업무와 관련이 없다" not in chunks["소득세법-33-1-9"].body


def _case(hierarchy, body):
    return {
        "id": 1,
        "statute_id": "심판례-115544",
        "doc_id": "115544",
        "doc_type": "심판례해석",
        "hierarchy": hierarchy,
        "effective_from": date(1997, 8, 21),
        "effective_to": None,
        "is_superseded": False,
        "body": body,
        "body_hash": "x",
    }


DECC = _case(
    "심판례",
    "구분기장하여야 함\n심판청구를 기각합니다.\n"
    "1. 처분개요청구인은 쟁점아파트에 거주하면서"
    "2. 청구인 주장 및 국세청장 의견가. 청구인 주장당연히 필요경비 산입하는 것이므로"
    "3. 심리 및 판단가. 쟁점구분하여 기장하여야 한다",
)


def test_decc_splits_claim_from_judgment():
    sections = {c.section: c.body for c in chunk_case(DECC)}
    assert sections["요지"] == "구분기장하여야 함"
    assert "구분하여 기장하여야" in sections["심리판단"]
    assert "당연히 필요경비 산입하는 것이므로" not in sections["심리판단"]
    assert "당연히 필요경비 산입하는 것이므로" in sections["주장"]
    assert "주문" not in sections


def test_decc_drops_reason_when_boundary_is_missing():
    body = DECC["body"].replace("3. 심리 및 판단", "심리 및 판단")
    sections = {c.section for c in chunk_case(_case("심판례", body))}
    assert sections == {"요지"}


def test_decc_keeps_reason_when_no_claim_section():
    body = "요지\n주문\n1. 처분개요만 있는 짧은 결정문"
    sections = {c.section: c.body for c in chunk_case(_case("심판례", body))}
    assert sections["이유"] == "1. 처분개요만 있는 짧은 결정문"


def test_expc_keeps_all_three_fields():
    row = _case("해석례", "질의요지다\n회답이다\n이유다")
    assert {c.section: c.body for c in chunk_case(row)} == {
        "질의": "질의요지다",
        "회답": "회답이다",
        "이유": "이유다",
    }


def test_dispatch_mixes_statutes_and_cases(chunks):
    rows = [DECC]
    assert [c.section for c in chunk(rows)] == ["요지", "주장", "심리판단"]
