import pytest

from pipeline.law_sync import _stale

CURRENT = {f"소득세법-{i}" for i in range(200)}


def test_closes_only_missing():
    assert _stale(CURRENT, CURRENT - {"소득세법-13"}) == {"소득세법-13"}


def test_new_statutes_are_not_stale():
    assert _stale(CURRENT, CURRENT | {"소득세법-201"}) == set()


def test_empty_db():
    assert _stale(set(), set()) == set()


def test_small_deletion_is_allowed():
    """개정 한 번에 조문 몇 개가 지워지는 건 정상이다."""
    gone = {f"소득세법-{i}" for i in range(5)}
    assert _stale(CURRENT, CURRENT - gone) == gone


def test_aborts_on_mass_disappearance():
    with pytest.raises(SystemExit):
        _stale(CURRENT, {"소득세법-0"})
