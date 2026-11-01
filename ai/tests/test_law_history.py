from datetime import date

from pipeline.law_sync import segments, versions
from pipeline.parse import Unit


def _row(ef: str, pub: str, mst: int) -> dict:
    return {"시행일자": ef, "공포일자": pub, "법령일련번호": str(mst)}


# 소득세법 시행령 연혁 목록 일부(2026-10 실측). 한 공포본이 시행일마다 한 줄씩 나온다
ROWS = [
    _row("20261001", "20260930", 290841),
    _row("20260701", "20260522", 286211),
    _row("20260701", "20251230", 280865),
    _row("20260101", "20251231", 282539),
    _row("20260101", "20250228", 269541),
    _row("20250701", "20250630", 272559),
    _row("20240101", "20231228", 257437),
    _row("20231001", "20230925", 250000),
]


def test_picks_latest_promulgation_per_date():
    picked = versions(ROWS, date(2026, 1, 1), date(2026, 10, 1))
    assert picked == [
        (date(2026, 1, 1), "282539"),
        (date(2026, 7, 1), "286211"),
    ]


def test_starts_from_version_in_force_on_since():
    """since 당일에 시행된 판이 없으면 그때 시행 중이던 더 이른 판부터다."""
    picked = versions(ROWS, date(2024, 3, 1), date(2025, 1, 1))
    assert picked == [(date(2024, 1, 1), "257437")]


def test_rerun_adds_nothing():
    """첫 런이 since(2024-01-01) 판부터 채웠으면 다음 런의 적재 시작도 그날이다.
    그때 시행 중이던 2023-10-01 판을 다시 끌어오면 안 된다."""
    assert versions(ROWS, date(2024, 1, 1), date(2024, 1, 1)) == []
    assert versions(ROWS, date(2024, 3, 1), date(2024, 1, 1)) == []


def _unit(sid: str, body: str) -> Unit:
    return Unit(
        statute_id=sid, doc_type="법령", doc_id="003956", unit_level="호", hierarchy="시행령",
        title="소득세법 시행령", doc_no="1", effective_from=date(2099, 1, 1), issued_at=None,
        body=body, source_url="", meta={},
    )


JAN, JUL, OCT = date(2026, 1, 1), date(2026, 7, 1), date(2026, 10, 1)


def _spans(out):
    return {(u.statute_id, u.body, u.effective_from, until) for u, until in out}


def test_unchanged_statute_is_one_row_until_loaded():
    out = segments([(JAN, [_unit("a", "x")]), (JUL, [_unit("a", "x")])], OCT)
    assert _spans(out) == {("a", "x", JAN, OCT)}


def test_changed_statute_closes_at_change():
    out = segments([(JAN, [_unit("a", "x")]), (JUL, [_unit("a", "y")])], OCT)
    assert _spans(out) == {("a", "x", JAN, JUL), ("a", "y", JUL, OCT)}


def test_removed_and_added_statutes():
    out = segments([(JAN, [_unit("a", "x")]), (JUL, [_unit("b", "z")])], OCT)
    assert _spans(out) == {("a", "x", JAN, JUL), ("b", "z", JUL, OCT)}
