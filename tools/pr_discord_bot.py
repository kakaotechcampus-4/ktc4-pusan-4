import argparse
import json
import os
import re
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import NamedTuple

DISCORD_CONTENT_LIMIT = 2000
REVIEW_WAIT_THRESHOLD = timedelta(hours=24)
# 새 PR 알림은 이만큼 기다렸다가 리뷰어를 조회하고, 그 사이 들어온 리뷰 요청은 따로 알리지 않는다.
REVIEWER_SETTLE_WINDOW = timedelta(minutes=2)


def mention(login: str, user_ids: dict[str, str]) -> str:
    if login in user_ids:
        return f"<@{user_ids[login]}>"
    return f"@{login}"


def _pr_link(pr: dict) -> str:
    return f"#{pr['number']} [{pr['title']}]({pr['html_url']})"


def build_new_pr_message(pr: dict, user_ids: dict[str, str]) -> str:
    reviewers = (
        " ".join(
            mention(reviewer["login"], user_ids)
            for reviewer in pr["requested_reviewers"]
        )
        or "미지정"
    )
    return (
        f"🆕 새 PR {_pr_link(pr)}\n"
        f"{pr['user']['login']} · {pr['head']['ref']} → {pr['base']['ref']}\n"
        f"리뷰어: {reviewers}"
    )


def build_review_request_message(pr: dict, login: str, user_ids: dict[str, str]) -> str:
    return f"👀 {mention(login, user_ids)} 리뷰 요청: {_pr_link(pr)} · {pr['user']['login']}"


def is_late_review_request(
    pr: dict, requested_at: datetime, last_ready: datetime | None
) -> bool:
    # PR 생성·ready 직후 지정된 리뷰어는 새 PR 알림이 기다렸다가 함께 멘션한다(#41: ready 27초 뒤 5명 지정).
    # draft 에서 받은 요청은 ready_for_review 알림에서 멘션된다.
    created_at = datetime.fromisoformat(pr["created_at"])
    opened_at = max(created_at, last_ready) if last_ready else created_at
    return not pr["draft"] and requested_at - opened_at > REVIEWER_SETTLE_WINDOW


def latest_request_times(events: list[dict]) -> dict[str, datetime]:
    times: dict[str, datetime] = {}
    for event in events:
        if event["event"] != "review_requested" or "requested_reviewer" not in event:
            continue
        login = event["requested_reviewer"]["login"]
        requested_at = datetime.fromisoformat(event["created_at"])
        if login not in times or requested_at > times[login]:
            times[login] = requested_at
    return times


def last_ready_time(events: list[dict]) -> datetime | None:
    return max(
        (
            datetime.fromisoformat(event["created_at"])
            for event in events
            if event["event"] == "ready_for_review"
        ),
        default=None,
    )


def wait_start_times(events: list[dict]) -> dict[str, datetime]:
    # draft 일 때 받은 요청은 ready 로 바뀐 시점부터 기다린 것으로 본다.
    last_ready = last_ready_time(events)
    return {
        login: max(requested_at, last_ready) if last_ready else requested_at
        for login, requested_at in latest_request_times(events).items()
    }


class StaleReview(NamedTuple):
    pr: dict
    login: str
    waited: timedelta


def find_stale_reviews(
    prs: list[dict],
    wait_starts_by_pr: dict[int, dict[str, datetime]],
    now: datetime,
    threshold: timedelta,
) -> list[StaleReview]:
    stale = []
    for pr in prs:
        wait_starts = wait_starts_by_pr[pr["number"]]
        for reviewer in pr["requested_reviewers"]:
            waited = now - wait_starts[reviewer["login"]]
            if waited >= threshold:
                stale.append(StaleReview(pr, reviewer["login"], waited))
    return stale


def is_reminder_target(pr: dict) -> bool:
    # develop → main 은 운영진 notify-discord 워크플로가 멘토에게 알린다.
    return not pr["draft"] and pr["base"]["ref"] != "main"


def build_reminder_message(
    stale: list[StaleReview], user_ids: dict[str, str]
) -> str | None:
    if not stale:
        return None
    by_pr: dict[int, list[StaleReview]] = {}
    for review in stale:
        by_pr.setdefault(review.pr["number"], []).append(review)

    lines = ["⏰ 리뷰를 기다리는 PR이 있어요"]
    for reviews in by_pr.values():
        pr = reviews[0].pr
        waiting = ", ".join(
            f"{mention(review.login, user_ids)} ({int(review.waited.total_seconds() // 3600)}시간)"
            for review in reviews
        )
        lines.append(f"• {_pr_link(pr)} · {pr['user']['login']} → {waiting}")
    return "\n".join(lines)


def split_message(content: str, limit: int = DISCORD_CONTENT_LIMIT) -> list[str]:
    # 한 줄은 PR 하나라 limit 을 넘지 않는다. 줄 단위로만 자른다.
    chunks: list[str] = []
    current = ""
    for line in content.split("\n"):
        candidate = f"{current}\n{line}" if current else line
        if len(candidate) > limit:
            chunks.append(current)
            candidate = line
        current = candidate
    chunks.append(current)
    return chunks


def _github_request(url: str, token: str) -> urllib.request.Request:
    return urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
        },
    )


def github_get(url: str, token: str) -> dict:
    with urllib.request.urlopen(_github_request(url, token), timeout=30) as response:
        return json.load(response)


def github_get_all(url: str, token: str) -> list[dict]:
    items: list[dict] = []
    next_url: str | None = url
    while next_url:
        with urllib.request.urlopen(
            _github_request(next_url, token), timeout=30
        ) as response:
            items.extend(json.load(response))
            match = re.search(
                r'<([^>]+)>; rel="next"', response.headers.get("Link", "")
            )
            next_url = match.group(1) if match else None
    return items


def post_discord(webhook_url: str, content: str) -> None:
    for chunk in split_message(content):
        payload = {
            "content": chunk,
            "allowed_mentions": {"parse": ["users"]},  # @everyone·역할 멘션 차단
            "flags": 4,  # 링크 미리보기(embed) 끄기
        }
        request = urllib.request.Request(
            webhook_url,
            data=json.dumps(payload).encode("utf-8"),
            # 기본 Python-urllib User-Agent 는 Discord 앞단에서 403 으로 막힌다.
            headers={
                "Content-Type": "application/json",
                "User-Agent": "ktc4-pr-discord-bot",
            },
            method="POST",
        )
        urllib.request.urlopen(request, timeout=30).close()


def collect_notification(
    event: dict,
    repo: str,
    token: str,
    user_ids: dict[str, str],
    now: datetime,
    settle_seconds: float,
) -> str | None:
    api = f"https://api.github.com/repos/{repo}"
    pr_url = f"{api}/pulls/{event['pull_request']['number']}"
    if event["action"] != "review_requested":
        # 열자마자 지정하는 리뷰어까지 한 메시지에 담으려고 기다렸다가 다시 조회한다.
        time.sleep(settle_seconds)
        return build_new_pr_message(github_get(pr_url, token), user_ids)

    if "requested_reviewer" not in event:  # 팀 단위 요청
        return None
    pr = github_get(pr_url, token)
    login = event["requested_reviewer"]["login"]
    events = github_get_all(f"{api}/issues/{pr['number']}/events?per_page=100", token)
    requested_at = latest_request_times(events).get(login, now)
    if not is_late_review_request(pr, requested_at, last_ready_time(events)):
        return None
    return build_review_request_message(pr, login, user_ids)


def collect_reminder(
    repo: str, token: str, user_ids: dict[str, str], now: datetime
) -> str | None:
    api = f"https://api.github.com/repos/{repo}"
    prs = [
        pr
        for pr in github_get_all(f"{api}/pulls?state=open&per_page=100", token)
        if is_reminder_target(pr) and pr["requested_reviewers"]
    ]
    wait_starts_by_pr = {
        pr["number"]: wait_start_times(
            github_get_all(f"{api}/issues/{pr['number']}/events?per_page=100", token)
        )
        for pr in prs
    }
    stale = find_stale_reviews(prs, wait_starts_by_pr, now, REVIEW_WAIT_THRESHOLD)
    return build_reminder_message(stale, user_ids)


def main() -> None:
    parser = argparse.ArgumentParser(description="팀 내부 PR 을 Discord 로 알린다.")
    parser.add_argument("command", choices=["notify", "remind"])
    parser.add_argument(
        "--dry-run", action="store_true", help="기다리거나 전송하지 않고 출력만 한다"
    )
    args = parser.parse_args()

    # repo variable 이 없으면 Actions 가 빈 문자열을 넘긴다.
    user_ids = json.loads(os.environ.get("DISCORD_USER_IDS") or "{}")

    repo = os.environ["GITHUB_REPOSITORY"]
    token = os.environ["GITHUB_TOKEN"]
    now = datetime.now(timezone.utc)
    if args.command == "notify":
        with open(os.environ["GITHUB_EVENT_PATH"], encoding="utf-8") as event_file:
            event = json.load(event_file)
        settle_seconds = 0 if args.dry_run else REVIEWER_SETTLE_WINDOW.total_seconds()
        content = collect_notification(
            event, repo, token, user_ids, now, settle_seconds
        )
    else:
        content = collect_reminder(repo, token, user_ids, now)

    if content is None:
        print("보낼 알림이 없습니다.")
    elif args.dry_run:
        print(content)
    else:
        post_discord(os.environ["TEAM_DISCORD_WEBHOOK"], content)


if __name__ == "__main__":
    main()
