"""승인 후보를 카드로 채우는 부분. GitHub 과 DB 호출은 여기서 검증하지 않는다."""

import re
from datetime import date
from fnmatch import fnmatch

import pytest
import yaml

from pipeline.draft import RuleCardDraft, render
from pipeline.promote import card_path, finalize
from pipeline.select import Evidence, StatuteRef

APPROVED = date(2026, 11, 2)
DRAFT = render(
    RuleCardDraft(gate="G2", verdict="확인필요", account=None),
    Evidence(sufficient=True, refs=[StatuteRef(statute_id="소득세법-35-1", quote="기업업무추진비라 한다")],
             direction="확인필요", note="거래처 동반 여부로 갈린다"),
    "카페", "940909", date(2026, 10, 25),
)


def test_id_시행일_검토를_승인일로_채운다():
    text = finalize(DRAFT, 17, APPROVED)
    card = yaml.safe_load(text)
    assert card["id"] == "R-C17"
    assert card["effective_period"] == {"start": APPROVED, "end": None}
    assert card["review"] == {"by": "관리자", "date": APPROVED}
    assert "TODO" not in text and "미검수" not in text


def test_근거_메모는_남고_초안_안내는_승격_표시로_바뀐다():
    text = finalize(DRAFT, 17, APPROVED)
    assert text.startswith("# 거래처 동반 여부로 갈린다")
    assert "# 규칙 후보 #17 에서 승격. 승인 2026-11-02" in text
    assert "자동 생성 초안" not in text and "승인 시점에 박는다" not in text


def test_형식이_다른_초안은_거른다():
    with pytest.raises(ValueError):
        finalize(DRAFT.replace("id: TODO", "id: R-900"), 17, APPROVED)


def test_파일명은_카드_글롭에_맞고_생성_카드로_오인되지_않는다():
    name = card_path(17, "카페").rsplit("/", 1)[1]
    assert fnmatch(name, "R-*.yaml")
    assert not re.fullmatch(r"R-\d{9}_.+\.yaml", name)
