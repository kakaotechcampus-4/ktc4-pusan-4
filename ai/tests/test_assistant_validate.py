"""비서 최종 답 검증."""

import pytest

from assistant.validate import problems

SOURCES = ['{"count": 5, "sum": 40800, "items": [{"date": "2026-09-12(토)", "amount": 12800}]}', "9월에 카페에서 얼마 썼어?"]
CITATIONS = ["소득세법 제33조 제1항 제5호"]


def test_도구_결과의_숫자와_조문만_쓴_답은_통과한다():
    answer = "9월 카페 결제는 5건, 합계 40,800원입니다. 근거는 소득세법 제33조입니다. 2026년 9월 12일 결제가 가장 큽니다."
    assert problems(answer, SOURCES, CITATIONS) == []


@pytest.mark.parametrize(("answer", "reason"), [
    ("합계 45,000원입니다.", "숫자 45,000"),
    ("관리비는 50% 정도로 하시면 됩니다.", "숫자 50"),
    ("소득세법 제27조에 따라 가능합니다.", "제27조"),
    ("확인했습니다!", "느낌표"),
    ("**합계**는 40,800원입니다.", "마크다운"),
    ("남은 질문은\n- 통신\n- 구독입니다.", "마크다운"),
    ("합계는 40,800원이에요.", "'-요'체"),
    ("g1 질문에 답하면 됩니다.", "내부 별칭"),
    ("AI 추천 답을 넣었습니다.", "'AI 추천'"),
])
def test_반려_사유를_돌려준다(answer, reason):
    assert any(reason in p for p in problems(answer, SOURCES, CITATIONS))


def test_조_원은_조문으로_보지_않는다():
    assert not any("조문" in p for p in problems("국가 예산은 12조 원입니다.", ["12"], []))
