from datetime import date

from app.config import ROOT
from pipeline.sync_report import LIMIT, cited, hit, render

DAY = date(2026, 10, 11)
RULE = "업무용승용차운행기록방법에관한고시#2104628"


def _row(sid, doc_type="법령", title="소득세법", ef="2027-01-01", revised=True):
    return {
        "doc_type": doc_type,
        "hierarchy": "법률",
        "title": title,
        "statute_id": sid,
        "doc_no": None,
        "effective_from": date.fromisoformat(ef),
        "revised": revised,
    }


def test_hit_matches_self_and_children_only():
    assert hit("소득세법-27-1", "소득세법-27-1")
    assert hit("소득세법-27-1", "소득세법-27-1-2")
    assert not hit("소득세법-33-1-5", "소득세법-33")
    assert not hit("소득세법-33", "소득세법-33의2")
    assert not hit("소득세법-27-1", "소득세법-27-10")
    assert hit(f"{RULE}-3", f"{RULE}-3")


def test_cited_reads_card_and_option_citations(tmp_path):
    cards = tmp_path / "cards"
    cards.mkdir()
    (cards / "R-001_통신.yaml").write_text(
        "id: R-001\ncitations:\n  - id: 소득세법-27-1\n    verified: true\n", encoding="utf-8"
    )
    (cards / "R-301_음식점.yaml").write_text(
        "id: R-301\n"
        "citations:\n  - { id: 소득세법-33-1-5, verified: true }\n"
        "question:\n  options:\n"
        "    - { value: 업무미팅, citations: [{ id: 소득세법-35-1, verified: true }] }\n"
        "    - { value: 개인 }\n",
        encoding="utf-8",
    )
    assert cited(tmp_path) == {
        "소득세법-27-1": {"R-001_통신"},
        "소득세법-33-1-5": {"R-301_음식점"},
        "소득세법-35-1": {"R-301_음식점"},
    }


def test_real_cards_include_option_citations():
    refs = cited(ROOT / "rules")
    assert "소득세법-27-1" in refs
    assert "소득세법-35-1" in refs


def test_no_change():
    msg = render([], [], 0, {"소득세법-27-1": {"R-001"}}, [], DAY)
    assert msg.startswith("📚 법령 코퍼스 주간 동기화 · 10/11 (일) ✅")
    assert "🃏 영향 카드 없음" in msg
    assert "수정된 조문 참조:\n없음\n삭제된 조문 참조:\n없음" in msg
    assert "변경 없음" in msg
    assert msg.count("```") == 4


def test_failure_and_missing_cards():
    msg = render([], [], 0, {}, ["admrul", "reindex"], DAY)
    assert "⚠️ 일부 실패 — admrul, reindex" in msg
    assert "카드 목록을 읽지 못함" in msg


def test_cards_split_by_revised_and_deleted():
    new = [_row("소득세법-27-1-2"), _row("소득세법-33")]
    closed = [{"doc_type": "행정규칙", "title": "업무용승용차 고시", "statute_id": f"{RULE}-3"}]
    cards = {
        "소득세법-27-1": {"R-001_통신"},
        "소득세법-33-1-5": {"R-301_음식점"},
        f"{RULE}-3": {"R-070_업무용승용차"},
    }
    msg = render(new, closed, 12, cards, [], DAY)
    card_block, change_block = msg.split("📋 변경사항")
    assert "🃏 영향 카드 2장" in card_block
    revised, deleted = card_block.split("삭제된 조문 참조:")
    assert "소득세법-27-1 [시행 2027-01-01] R-001_통신" in revised
    assert "R-301" not in msg
    assert "R-070_업무용승용차" in deleted
    assert "법령 2건 (개정 2 · 신설 0 · 삭제 0)" in change_block
    assert "• 소득세법 [2027-01-01 시행] 제27조, 제33조" in change_block
    assert "행정규칙 1건 (개정 0 · 신설 0 · 삭제 1)" in change_block
    assert "재색인 12청크" in change_block


def test_caps_and_limit():
    new = [_row(f"소득세법-{i}의2") for i in range(1, 11)]
    cards = {"소득세법-1의2": {f"R-{i:03d}" for i in range(12)}}
    msg = render(new, [], 0, cards, [], DAY)
    assert "… 외 2장" in msg
    assert "제1조의2, 제2조의2" in msg and "… 외 2개" in msg

    many = [_row(f"소득세법-{i}", title=f"법령{i}") for i in range(500)]
    msg = render(many, [], 0, cards, [], DAY)
    assert len(msg) <= LIMIT
    assert msg.count("```") == 4
    assert msg.rstrip("`").rstrip().endswith("…(잘림)")
