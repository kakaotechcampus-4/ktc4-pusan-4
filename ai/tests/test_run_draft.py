"""초안 하네스의 채점 부분. 모델·DB 없이 돈다."""

import pytest

from eval.run_draft import _same, grade_verdict, score, wanted


@pytest.mark.parametrize(
    ("a", "b", "same"),
    [
        ("소득세법-33-1-5", "소득세법-33-1-5", True),
        ("소득세법시행령-67-4", "소득세법시행령-67", True),   # 색인이 카드보다 하위
        ("소득세법-35", "소득세법-35-1", True),               # 카드가 색인보다 하위
        ("소득세법-33-1-5", "소득세법-33-1-9", False),        # 형제는 다른 조문이다
        ("소득세법-3", "소득세법-33", False),                 # 접두만 겹치는 건 아니다
    ],
)
def test_조항호_입도가_달라도_같은_조문으로_본다(a, b, same):
    assert _same(a, b) is same


@pytest.mark.parametrize(
    ("got", "want", "grade"),
    [
        ("가능", {"가능"}, "일치"),
        ("가능", {"확인필요"}, "과잉확정"),   # 카드는 물어보라는데 초안이 확정했다
        ("확인필요", {"가능"}, "보수적"),     # 미탐. 확인필요로 떨어지므로 덜 위험하다
        ("불가", {"가능"}, "반대"),
        (None, {"가능"}, "비움"),
        ("가능", set(), "—"),                 # 속성 관문뿐이라 잴 게 없다
    ],
)
def test_결론은_틀리는_방향을_나눠_센다(got, want, grade):
    assert grade_verdict(got, want) == grade


def test_놓친_근거를_검색_탓과_선택_탓으로_가른다():
    want = {
        "cites": {"소득세법-35-1", "소득세법-33-1-5", "소득세법-160의2-2"},
        "gates": {"G2"},
        "verdicts": {"확인필요"},
    }
    got = {
        "refs": ["소득세법-35-1-1", "부가가치세법-39-1-6"],
        # 33-1-5 는 후보에 있었는데 안 골랐고, 160의2-2 는 후보에 없었다
        "pool": ["소득세법-35-1-1", "소득세법-33-1-5", "부가가치세법-39-1-6"],
        "gate": "G2",
        "verdict": "가능",
    }
    assert score(got, want) == {
        "hit": 1,
        "want": 3,
        "unpicked": ["소득세법-33-1-5"],
        "unfound": ["소득세법-160의2-2"],
        "stray": ["부가가치세법-39-1-6"],
        "gate_ok": True,
        "verdict": "과잉확정",
    }


def test_정답지는_카드에서_나온다():
    keys = wanted()
    assert ("카페", "940909") in keys
    카페 = keys[("카페", "940909")]
    assert 카페["gates"] == {"G2"} and 카페["verdicts"] == {"확인필요"}
    # 한 카테고리에 카드가 여럿이면 묶어서 본다
    쇼핑 = keys[("온라인쇼핑", "940909")]
    assert len(쇼핑["cards"]) > 1 and 쇼핑["gates"] == {"G2", "G4"}
