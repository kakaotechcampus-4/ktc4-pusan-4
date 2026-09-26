"""초안 렌더링. 모델 호출과 DB 조회는 여기서 검증하지 않는다."""

from datetime import date

import yaml

from pipeline.draft import PRIORITY, RuleCardDraft, render
from pipeline.select import Evidence, StatuteRef

# docs/rule-card-fields.md 의 13개. 여기 없는 최상위 필드를 두면 로더가 조용히 무시한다.
FIELDS = {
    "id", "version", "gate", "priority", "effective_period", "match",
    "verdict", "out_of_scope", "account", "citations", "attributes",
    "question", "review",
}

TODAY = date(2026, 9, 22)
REFS = [
    StatuteRef(statute_id="소득세법-35-1", quote="접대, 교제, 사례 등의 명목으로"),
    StatuteRef(statute_id="소득세법-35-1", quote="기업업무추진비라 한다"),
]


def ev(refs=REFS, note="거래처 동반 여부로 갈린다", direction="확인필요"):
    return Evidence(sufficient=True, refs=refs, direction=direction, note=note)


def card(gate="G2", verdict="확인필요", account=None):
    return RuleCardDraft(gate=gate, verdict=verdict, account=account)


def load(**kw):
    return yaml.safe_load(render(card(**kw), ev(), "카페", "940909", TODAY))


def test_yaml_로_파싱된다():
    assert load()["gate"] == "G2"


def test_13개_밖의_필드를_두지_않는다():
    assert set(load()) <= FIELDS


def test_match_는_집계행에서_온다():
    assert load()["match"] == {"category": ["카페"], "industry": ["940909"]}


def test_업종코드는_문자열로_남는다():
    # 따옴표가 빠지면 940909 가 int 로 파싱돼 varchar(6) 비교가 어긋난다
    assert isinstance(load()["match"]["industry"][0], str)


def test_citations_는_중복을_접는다():
    assert load()["citations"] == [{"id": "소득세법-35-1", "verified": True}]


def test_priority_는_학습룰_대역_위다():
    assert 400 < load()["priority"] == PRIORITY


def test_승인_전에는_id_와_시행일이_비어_있다():
    got = load()
    assert got["id"] == "TODO" and got["effective_period"]["start"] == "TODO"


def test_verdict_없는_속성관문은_필드를_안_쓴다():
    assert "verdict" not in load(gate="G5", verdict=None)


def test_account_는_있을_때만_쓴다():
    assert "account" not in load()
    assert load(account="접대비")["account"] == "접대비"


def test_근거_요지가_주석으로_남는다():
    assert render(card(), ev(), "카페", "940909", TODAY).startswith("# 거래처 동반 여부로 갈린다")


def test_근거가_없으면_citations_를_안_쓴다():
    text = render(card(), ev(refs=[]), "카페", "940909", TODAY)
    assert "citations" not in yaml.safe_load(text)


def test_G1인데_33조를_안_물면_반려():
    from pipeline.draft import _check
    bad = _check(card(gate="G1", verdict="불가"), ev())
    assert len(bad) == 1 and "33조" in bad[0]


def test_G1이_33조를_물면_통과():
    from pipeline.draft import _check
    refs = [StatuteRef(statute_id="소득세법-33-1-2", quote="벌금ㆍ과료와 과태료")]
    assert _check(card(gate="G1", verdict="불가"), ev(refs=refs)) == []


def test_차단형은_verdict_가_있어야_한다():
    from pipeline.draft import _check
    bad = _check(card(gate="G2", verdict=None), ev())
    assert len(bad) == 1 and "차단형" in bad[0]


def test_속성관문은_verdict_없어도_된다():
    from pipeline.draft import _check
    assert _check(card(gate="G5", verdict=None), ev()) == []


def test_여러_줄_note_도_전부_주석이다():
    두줄 = ev(note="업무 관련성이 인정되는 경우에 한한다\n다만 가사 관련분은 제외한다")
    text = render(card(), 두줄, "카페", "940909", TODAY)
    # 둘째 줄이 주석 밖으로 나가면 카드 전체가 파싱 실패한다
    assert yaml.safe_load(text)["gate"] == "G2"
    assert "# 다만 가사 관련분은 제외한다" in text
