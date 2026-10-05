"""적재 직전에 값을 만드는 부분. SQL 과 모델 호출은 여기서 검증하지 않는다."""

from pipeline.candidates import docs, top_tier
from pipeline.search import Hit
from pipeline.select import Evidence, StatuteRef


def hit(sid, tier):
    return Hit(id=abs(hash(sid)) % 10**6, statute_id=sid, doc_id="X", doc_type=tier,
               hierarchy=tier, section=None, body="본문", score=0.01)


BY_TIER = {
    "법령": [hit("소득세법-33-1-5", "법령")],
    "행정규칙": [hit("고시#1-1", "행정규칙")],
    "심판례해석": [hit("심판례-1", "심판례해석")],
}


def ev(*ids):
    return Evidence(
        sufficient=True,
        refs=[StatuteRef(statute_id=i, quote="열 글자가 넘는 인용문이다") for i in ids],
        direction="불가",
        note="",
    )


def test_인용이_여러_위계면_가장_위를_쓴다():
    assert top_tier(ev("심판례-1", "소득세법-33-1-5"), BY_TIER) == "법령"


def test_하위만_인용하면_그_위계다():
    assert top_tier(ev("심판례-1"), BY_TIER) == "심판례해석"


def test_기본_조문만_인용해도_법령이다():
    by_tier = {"기본": [hit("소득세법-33-1-1", "법령")], **BY_TIER}
    assert top_tier(ev("소득세법-33-1-1"), by_tier) == "법령"


def test_인용이_없으면_없다():
    assert top_tier(ev(), BY_TIER) is None


def test_suggested_docs_에_위계가_붙는다():
    got = docs(ev("고시#1-1"), BY_TIER)
    assert got == [{"statute_id": "고시#1-1", "quote": "열 글자가 넘는 인용문이다", "tier": "행정규칙"}]
