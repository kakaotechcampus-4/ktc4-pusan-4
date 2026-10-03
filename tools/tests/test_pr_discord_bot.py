from datetime import datetime, timedelta, timezone

import pytest

from tools.pr_discord_bot import (
    build_new_pr_message,
    build_reminder_message,
    build_review_notification,
    build_review_request_message,
    due_reviewers,
    is_late_review_request,
    latest_request_times,
    mention,
    mentioned_logins,
)


def make_pr(
    number=45, reviewers=("cho104", "Jaeseong22"), base="develop", draft=False, state="open"
):
    return {
        "number": number,
        "title": "RAG 파이프라인",
        "html_url": f"https://github.com/o/r/pull/{number}",
        "user": {"login": "yuyeol3"},
        "head": {"ref": "feature/rag"},
        "base": {"ref": base},
        "draft": draft,
        "state": state,
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


def requested(login, at):
    return {
        "event": "review_requested",
        "created_at": at.isoformat(),
        "requested_reviewer": {"login": login},
    }


def ready(at):
    return {"event": "ready_for_review", "created_at": at.isoformat()}


DAY = timedelta(hours=24)
LATE = PR_CREATED + timedelta(minutes=3)
WITH_PR = [
    requested("cho104", PR_CREATED),
    requested("Jaeseong22", PR_CREATED + timedelta(seconds=27)),
]
ONE_LATE = [requested("cho104", PR_CREATED), requested("Jaeseong22", LATE)]
RE_REQUESTED = [*ONE_LATE, requested("Jaeseong22", LATE + timedelta(hours=5))]
DRAFT_THEN_READY = [requested("cho104", PR_CREATED), ready(READY)]


@pytest.mark.parametrize(
    ("pr", "events", "action", "login", "now", "expected"),
    [
        (make_pr(), WITH_PR, "opened", None, PR_CREATED + DAY, ["cho104", "Jaeseong22"]),
        (make_pr(), ONE_LATE, "opened", None, PR_CREATED + DAY, ["cho104"]),
        (make_pr(), ONE_LATE, "review_requested", "Jaeseong22", LATE + DAY, ["Jaeseong22"]),
        (make_pr(), WITH_PR, "review_requested", "cho104", PR_CREATED + DAY, []),
        (make_pr(), RE_REQUESTED, "review_requested", "Jaeseong22", LATE + DAY, []),
        (make_pr(reviewers=("cho104",)), DRAFT_THEN_READY, "ready_for_review", None, READY + DAY, ["cho104"]),
        (make_pr(reviewers=("cho104",)), DRAFT_THEN_READY, "opened", None, PR_CREATED + DAY, []),
        (make_pr(reviewers=("Jaeseong22",)), WITH_PR, "opened", None, PR_CREATED + DAY, ["Jaeseong22"]),
        (make_pr(state="closed"), WITH_PR, "opened", None, PR_CREATED + DAY, []),
        (make_pr(draft=True), WITH_PR, "opened", None, PR_CREATED + DAY, []),
    ],
    ids=[
        "assigned-with-pr-grouped",
        "late-assignee-left-to-own-run",
        "late-assignee",
        "assigned-with-pr-left-to-opened-run",
        "re-requested-since",
        "draft-request-counted-from-ready",
        "ready-since-opened",
        "reviewed-reviewer-dropped",
        "closed",
        "draft",
    ],
)
def test_due_reviewers_mentions_each_waiting_reviewer_once(
    pr, events, action, login, now, expected
):
    assert due_reviewers(pr, events, action, login, now) == expected


def test_reminder_message_mentions_waiting_reviewers_on_authors_pr():
    message = build_reminder_message(make_pr(), ["cho104", "Jaeseong22"], {"cho104": "222"})

    assert message == (
        "리뷰 요청 후 24시간이 지났습니다.\n"
        "yuyeol3님의 PR #45 [RAG 파이프라인](https://github.com/o/r/pull/45): <@222>, @Jaeseong22"
    )


TEAM = {"yuyeol3": "111", "cho104": "222", "Jaeseong22": "333"}


def test_mentioned_logins_keeps_teammates_once_in_order():
    texts = [
        "@Jaeseong22님 `@Transactional` 확인 부탁",
        "cc @yuyeol3 mail@cho104.dev @jaeseong22",
    ]

    assert mentioned_logins(texts, TEAM) == ["Jaeseong22", "yuyeol3"]


def test_review_notification_tags_author_with_state_and_mentions():
    message = build_review_notification(
        make_pr(), "cho104", "request changes", ["@Jaeseong22 확인 부탁"], TEAM
    )

    assert message == (
        "<@111>\n"
        "PR #45 [RAG 파이프라인](https://github.com/o/r/pull/45)에 cho104의 리뷰가 달렸습니다.\n"
        "review: request changes\n"
        "mention: <@333>"
    )


def test_review_notification_says_none_when_only_self_is_mentioned():
    message = build_review_notification(make_pr(), "cho104", "none", ["@cho104 LGTM"], TEAM)

    assert message.endswith("review: none\nmention: 없음")


def test_authors_own_comment_notifies_mentioned_teammates():
    message = build_review_notification(
        make_pr(), "yuyeol3", "comment", ["@cho104 @Jaeseong22 반영했어요"], TEAM
    )

    assert message == (
        "<@222> <@333>\n"
        "yuyeol3의 PR #45 [RAG 파이프라인](https://github.com/o/r/pull/45)에서 cho104, Jaeseong22를 멘션했어요."
    )


@pytest.mark.parametrize(
    ("pr", "actor", "texts"),
    [
        (make_pr(), "yuyeol3", ["수정했습니다"]),
        (make_pr(), "outsider", ["@cho104 확인해 주세요"]),
        (make_pr(base="main"), "cho104", ["LGTM"]),
    ],
    ids=["author-without-mention", "not-teammate", "mentor-review-to-main"],
)
def test_review_notification_is_skipped(pr, actor, texts):
    assert build_review_notification(pr, actor, "comment", texts, TEAM) is None
