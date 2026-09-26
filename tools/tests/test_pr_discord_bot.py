from datetime import datetime, timedelta, timezone

import pytest

from tools.pr_discord_bot import (
    StaleReview,
    build_new_pr_message,
    build_reminder_message,
    build_review_request_message,
    find_stale_reviews,
    is_late_review_request,
    is_reminder_target,
    latest_request_times,
    mention,
    split_message,
    wait_start_times,
)


def make_pr(number=45, reviewers=("cho104", "Jaeseong22"), base="develop", draft=False):
    return {
        "number": number,
        "title": "RAG 파이프라인",
        "html_url": f"https://github.com/o/r/pull/{number}",
        "user": {"login": "yuyeol3"},
        "head": {"ref": "feature/rag"},
        "base": {"ref": base},
        "draft": draft,
        "created_at": "2026-09-22T05:54:32Z",
        "requested_reviewers": [{"login": login} for login in reviewers],
    }


def test_mention_uses_discord_id_when_login_is_mapped():
    assert mention("yuyeol3", {"yuyeol3": "111"}) == "<@111>"


def test_mention_falls_back_to_github_login_when_unmapped():
    assert mention("RainDrop3", {}) == "@RainDrop3"


def test_new_pr_message_shows_pr_link_branches_and_reviewer_mentions():
    message = build_new_pr_message(make_pr(), {"cho104": "222"})

    assert message == (
        "🆕 새 PR #45 [RAG 파이프라인](https://github.com/o/r/pull/45)\n"
        "yuyeol3 · feature/rag → develop\n"
        "리뷰어: <@222> @Jaeseong22"
    )


def test_new_pr_message_says_unassigned_when_no_reviewer_requested():
    message = build_new_pr_message(make_pr(reviewers=()), {})

    assert message.endswith("리뷰어: 미지정")


def test_review_request_message_mentions_requested_reviewer():
    message = build_review_request_message(make_pr(), "cho104", {"cho104": "222"})

    assert message == (
        "👀 <@222> 리뷰 요청: #45 [RAG 파이프라인](https://github.com/o/r/pull/45)"
        " · yuyeol3"
    )


PR_CREATED = datetime(2026, 9, 22, 5, 54, 32, tzinfo=timezone.utc)
READY = PR_CREATED + timedelta(hours=1)


@pytest.mark.parametrize(
    ("pr", "requested_at", "last_ready", "expected"),
    [
        (make_pr(), PR_CREATED + timedelta(minutes=3), None, True),
        (make_pr(), PR_CREATED, None, False),
        (make_pr(), PR_CREATED + timedelta(seconds=90), None, False),
        (make_pr(), READY + timedelta(seconds=27), READY, False),
        (make_pr(), READY + timedelta(minutes=3), READY, True),
        (make_pr(draft=True), PR_CREATED + timedelta(minutes=3), None, False),
    ],
    ids=[
        "assigned-later",
        "assigned-at-creation",
        "assigned-right-after-creation",
        "assigned-right-after-ready",
        "assigned-later-after-ready",
        "draft",
    ],
)
def test_is_late_review_request_skips_requests_already_in_new_pr_message(
    pr, requested_at, last_ready, expected
):
    assert is_late_review_request(pr, requested_at, last_ready) is expected


def test_latest_request_times_keeps_most_recent_request_per_reviewer():
    events = [
        {
            "event": "review_requested",
            "created_at": "2026-09-20T01:00:00Z",
            "requested_reviewer": {"login": "cho104"},
        },
        {"event": "reviewed", "created_at": "2026-09-20T05:00:00Z"},
        {
            "event": "review_requested",
            "created_at": "2026-09-21T01:00:00Z",
            "requested_reviewer": {"login": "cho104"},
        },
        {
            "event": "review_requested",
            "created_at": "2026-09-20T02:00:00Z",
            "requested_team": {"slug": "backend"},
        },
    ]

    assert latest_request_times(events) == {
        "cho104": datetime(2026, 9, 21, 1, 0, tzinfo=timezone.utc),
    }


def test_wait_start_times_counts_draft_period_requests_from_ready_for_review():
    events = [
        {
            "event": "review_requested",
            "created_at": "2026-09-20T01:00:00Z",
            "requested_reviewer": {"login": "cho104"},
        },
        {"event": "ready_for_review", "created_at": "2026-09-21T01:00:00Z"},
        {
            "event": "review_requested",
            "created_at": "2026-09-22T01:00:00Z",
            "requested_reviewer": {"login": "Jaeseong22"},
        },
    ]

    assert wait_start_times(events) == {
        "cho104": datetime(2026, 9, 21, 1, 0, tzinfo=timezone.utc),
        "Jaeseong22": datetime(2026, 9, 22, 1, 0, tzinfo=timezone.utc),
    }


NOW = datetime(2026, 9, 23, 1, 0, tzinfo=timezone.utc)
DAY = timedelta(hours=24)


@pytest.mark.parametrize(
    ("waited", "is_stale"),
    [(timedelta(hours=23, minutes=59), False), (DAY, True)],
)
def test_find_stale_reviews_includes_requests_waiting_at_least_threshold(
    waited, is_stale
):
    pr = make_pr(reviewers=("cho104",))
    request_times = {45: {"cho104": NOW - waited}}

    stale = find_stale_reviews([pr], request_times, NOW, DAY)

    assert stale == ([StaleReview(pr, "cho104", waited)] if is_stale else [])


@pytest.mark.parametrize(
    ("pr", "expected"),
    [
        (make_pr(), True),
        (make_pr(base="feature/rule-engine-core"), True),
        (make_pr(draft=True), False),
        (make_pr(base="main"), False),
    ],
    ids=["develop", "stacked", "draft", "mentor-review-to-main"],
)
def test_is_reminder_target_skips_drafts_and_mentor_review_prs(pr, expected):
    assert is_reminder_target(pr) is expected


def test_reminder_message_is_none_when_nothing_is_stale():
    assert build_reminder_message([], {}) is None


def test_reminder_message_groups_waiting_reviewers_by_pr():
    pr_44 = make_pr(number=44)
    pr_39 = make_pr(number=39)
    stale = [
        StaleReview(pr_44, "cho104", timedelta(hours=31, minutes=40)),
        StaleReview(pr_44, "Jaeseong22", timedelta(hours=25)),
        StaleReview(pr_39, "cho104", timedelta(days=3)),
    ]

    message = build_reminder_message(stale, {"cho104": "222"})

    assert message == (
        "⏰ 리뷰를 기다리는 PR이 있어요\n"
        "• #44 [RAG 파이프라인](https://github.com/o/r/pull/44) · yuyeol3 → <@222> (31시간), @Jaeseong22 (25시간)\n"
        "• #39 [RAG 파이프라인](https://github.com/o/r/pull/39) · yuyeol3 → <@222> (72시간)"
    )


def test_split_message_keeps_short_message_as_single_chunk():
    assert split_message("a\nb", limit=10) == ["a\nb"]


def test_split_message_breaks_on_line_boundaries_within_limit():
    lines = [f"line-{i:02d}" for i in range(10)]  # 각 7자

    chunks = split_message("\n".join(lines), limit=20)

    assert chunks == [
        "line-00\nline-01",
        "line-02\nline-03",
        "line-04\nline-05",
        "line-06\nline-07",
        "line-08\nline-09",
    ]
