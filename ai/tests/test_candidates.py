"""적재 직전에 값을 만드는 부분. SQL 과 모델 호출은 여기서 검증하지 않는다."""

from pipeline.candidates import docs, hold_reasons, top_tier
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


class 현행(list):
    """missing_statutes 가 쓰는 만큼만 흉내 낸다. 물어본 조문은 전부 현행이다."""

    def execute(self, sql, params):
        self[:] = [{"statute_id": i} for i in params[0]]
        return self

    def fetchall(self):
        return self


def test_확인필요는_근거_부족으로_보류하지_않는다():
    unsure = ev("소득세법-33-1-5").model_copy(update={"sufficient": False})
    assert hold_reasons(현행(), unsure, BY_TIER) == ["근거 부족"]
    assert hold_reasons(현행(), unsure.model_copy(update={"direction": "확인필요"}), BY_TIER) == []
    # 인용이 하나도 없으면 확인필요여도 보류한다
    empty = ev().model_copy(update={"sufficient": False, "direction": "확인필요"})
    assert hold_reasons(현행(), empty, BY_TIER) == ["근거 부족"]


def test_suggested_docs_에_위계가_붙는다():
    got = docs(ev("고시#1-1"), BY_TIER)
    assert got == [{"statute_id": "고시#1-1", "quote": "열 글자가 넘는 인용문이다", "tier": "행정규칙"}]
