"""근거 선택의 순수 부분. 모델 호출은 여기서 검증하지 않는다."""

from pipeline.search import Hit
from pipeline.select import (
    ARTICLE_CHARS,
    ARTICLE_NOTE,
    Evidence,
    StatuteRef,
    _candidates,
    _check,
    _pool,
    needs_review,
)


def hit(sid, tier, body, section=None, hier=None):
    return Hit(
        id=abs(hash(sid)) % 10**6,
        statute_id=sid,
        doc_id="X",
        doc_type=tier,
        hierarchy=hier or tier,
        section=section,
        body=body,
        score=0.01,
    )


LAW = hit("소득세법-33-1-5", "법령", "5. 대통령령으로 정하는 가사의 경비와 이에 관련되는 경비",
          hier="법률")
CASE = hit("심판례-115544", "심판례해석", "구분하여 기장하여야 한다", section="심리판단",
           hier="심판례")
POOL = {"법령": [LAW], "심판례해석": [CASE]}
FLAT = _pool(POOL)


def ev(refs, direction="불가", sufficient=True):
    return Evidence(sufficient=sufficient, refs=refs, direction=direction, note="")


def test_후보_밖_조문을_거른다():
    bad = _check(ev([StatuteRef(statute_id="소득세법-999", quote="대통령령으로 정하는 가사의 경비")]), FLAT)
    assert len(bad) == 1 and "후보에 없다" in bad[0]


def test_본문에_없는_인용문을_거른다():
    bad = _check(ev([StatuteRef(statute_id="소득세법-33-1-5", quote="본문에 없는 문장을 지어냈다")]), FLAT)
    assert len(bad) == 1 and "본문에 없다" in bad[0]


def test_원문_그대로면_통과():
    assert _check(ev([StatuteRef(statute_id="소득세법-33-1-5", quote="대통령령으로 정하는 가사의 경비")]), FLAT) == []


def test_개행을_공백으로_이어_적어도_통과():
    body = """제33조(필요경비 불산입)
5. 대통령령으로 정하는"""
    joined = "제33조(필요경비 불산입) 5. 대통령령으로"
    multi = hit("소득세법-33", "법령", body)
    assert _check(ev([StatuteRef(statute_id="소득세법-33", quote=joined)]), _pool({"법령": [multi]})) == []


def test_요약하면_여전히_걸린다():
    bad = _check(ev([StatuteRef(statute_id="소득세법-33-1-5", quote="가사경비는 필요경비에 산입하지 아니한다")]), FLAT)
    assert len(bad) == 1 and "본문에 없다" in bad[0]


def test_근거_없이_충분하다고_하면_거른다():
    bad = _check(ev([], sufficient=True), FLAT)
    assert len(bad) == 1 and "refs 가 비었다" in bad[0]


def test_근거가_없으면_비어도_된다():
    assert _check(ev([], sufficient=False), FLAT) == []


def test_심판례만으로_확정하면_보류():
    assert needs_review(ev([StatuteRef(statute_id="심판례-115544", quote="구분하여 기장")]), POOL)


def test_법령이_섞이면_보류_아님():
    refs = [
        StatuteRef(statute_id="심판례-115544", quote="구분하여 기장"),
        StatuteRef(statute_id="소득세법-33-1-5", quote="대통령령으로 정하는 가사의 경비"),
    ]
    assert not needs_review(ev(refs), POOL)


def test_확인필요면_심판례만이어도_보류_아님():
    refs = [StatuteRef(statute_id="심판례-115544", quote="구분하여 기장")]
    assert not needs_review(ev(refs, direction="확인필요"), POOL)


def test_후보를_위계별로_묶어_보여준다():
    text = _candidates(POOL)
    assert text.index("[법령]") < text.index("[심판례해석]")
    assert "(심리판단)" in text
    # 위계 순서를 지시하지 않는다 — 강요하면 쓸모 있는 심판례를 버린다
    assert "먼저" not in text


def test_띄어쓰기만_달라도_통과():
    body = """제78조의3(업무용승용차 특례)
⑦ 제4항을 적용할 때"""
    stuck = "제78조의3(업무용승용차 특례)⑦ 제4항을 적용할 때"
    h = _pool({"법령": [hit("영-78", "법령", body)]})
    assert _check(ev([StatuteRef(statute_id="영-78", quote=stuck)]), h) == []


def test_너무_짧은_인용은_거른다():
    bad = _check(ev([StatuteRef(statute_id="소득세법-33-1-5", quote="가사")]), FLAT)
    assert len(bad) == 1 and "너무 짧다" in bad[0]


def test_같은_심판례의_다른_섹션에서_인용해도_통과():
    """심판례 하나가 요지·심리판단 청크를 따로 갖는다. statute_id 는 같다."""
    요지 = hit("심판례-1", "심판례해석", "거주지를 사업장으로 겸용하는 경우의 안분", section="요지")
    판단 = hit("심판례-1", "심판례해석", "구분하여 기장하여야 한다고 판단된다", section="심리판단")
    pool = _pool({"심판례해석": [요지, 판단]})
    for q in ("거주지를 사업장으로 겸용하는 경우", "구분하여 기장하여야 한다고"):
        assert _check(ev([StatuteRef(statute_id="심판례-1", quote=q)]), pool) == []


# 조 전문으로 넓히기 — search.expand() 가 준 bodies 를 select 가 쓰는 부분
JO = """제78조의3(업무용승용차 특례)
③ 운행기록을 작성하여야 한다
⑤ 감가상각비 한도를 적용한다"""
LEAF3 = hit("영-78의3-3", "법령", "제78조의3(업무용승용차 특례)\n③ 운행기록을 작성하여야 한다")
LEAF5 = hit("영-78의3-5", "법령", "제78조의3(업무용승용차 특례)\n⑤ 감가상각비 한도를 적용한다")
BODIES = {"영-78의3-3": JO, "영-78의3-5": JO}


def test_같은_조는_전문을_한_번만_싣는다():
    text = _candidates({"법령": [LEAF3, LEAF5]}, BODIES)
    assert text.count(ARTICLE_NOTE) == 1
    # ID 는 라벨 하나에 본문 하나. 묶으면 어느 문장이 어느 호인지 모델이 못 맞춘다
    lines = text.splitlines()
    assert "  영-78의3-3" in lines and "  영-78의3-5" in lines


def test_상한을_넘는_조는_안_넓히고_잎_청크를_쓴다():
    긴조 = JO + "가" * ARTICLE_CHARS
    text = _candidates({"법령": [LEAF3]}, {"영-78의3-3": 긴조})
    assert ARTICLE_NOTE not in text
    assert "운행기록을 작성하여야 한다" in text
    assert "감가상각비" not in text


def test_넓힌_전문에서_베낀_인용이_통과한다():
    # 이 문장은 LEAF3 의 잎 청크엔 없고 조 전문에만 있다
    refs = [StatuteRef(statute_id="영-78의3-3", quote="감가상각비 한도를 적용한다")]
    assert _check(ev(refs), _pool({"법령": [LEAF3]}, BODIES)) == []


def test_안_보여준_전문은_인용처가_아니다():
    긴조 = JO + "가" * ARTICLE_CHARS
    refs = [StatuteRef(statute_id="영-78의3-3", quote="감가상각비 한도를 적용한다")]
    bad = _check(ev(refs), _pool({"법령": [LEAF3]}, {"영-78의3-3": 긴조}))
    assert len(bad) == 1 and "본문에 없다" in bad[0]


# 같은 doc_type 인데 위계로 갈린다 — 위임 고시는 대외적 구속력이 있고 훈령은 없다
고시 = hit("업무용승용차운행기록방법에관한고시#2104628-3", "행정규칙",
          "운행기록등을 작성ㆍ비치하여야 한다", hier="고시")
훈령 = hit("국세청당직근무규정-5", "행정규칙",
          "당직근무자는 근무상황을 기록하여야 한다", hier="훈령")


def test_위임_고시만으로도_확정할_수_있다():
    refs = [StatuteRef(statute_id=고시.statute_id, quote="운행기록등을 작성ㆍ비치하여야 한다")]
    assert not needs_review(ev(refs), {"행정규칙": [고시]})


def test_훈령만으로_선_확정은_보류다():
    refs = [StatuteRef(statute_id="국세청당직근무규정-5", quote="당직근무자는 근무상황을 기록하여야 한다")]
    assert needs_review(ev(refs), {"행정규칙": [훈령]})
