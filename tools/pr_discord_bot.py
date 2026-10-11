import argparse
import json
import os
import re
import time
import urllib.request
from datetime import datetime, timedelta, timezone

# pr-review-reminder.yml 의 environment(review-reminder) wait timer 와 같아야 한다.
REVIEW_WAIT_THRESHOLD = timedelta(hours=24)
# 첫 리마인드 뒤 반복 간격. environment(review-reminder-followup) wait timer 와 같아야 한다.
REMIND_INTERVAL = timedelta(hours=12)
# 새 PR 알림은 이만큼 기다렸다가 리뷰어를 조회하고, 그 사이 들어온 리뷰 요청은 따로 알리지 않는다.
REVIEWER_SETTLE_WINDOW = timedelta(minutes=2)
REVIEW_STATE_LABELS = {
    "APPROVED": "approve",
    "COMMENTED": "comment",
    "CHANGES_REQUESTED": "request changes",
}
DIVIDER = "-" * 51


def framed(title: str, body: str) -> str:
    return f"{DIVIDER}\n[{title}]\n{body}\n{DIVIDER}"


def mention(login: str, user_ids: dict[str, str]) -> str:
    if login in user_ids:
        return f"<@{user_ids[login]}>"
    return f"@{login}"


def _pr_link(pr: dict) -> str:
    return f"#{pr['number']} [{pr['title']}]({pr['html_url']})"


def _body_mentions(item: dict, user_ids: dict[str, str]) -> str:
    return " ".join(
        mention(login, user_ids)
        for login in mentioned_logins([item["body"] or ""], user_ids)
        if login != item["user"]["login"]
    )


def build_new_pr_message(pr: dict, user_ids: dict[str, str]) -> str:
    reviewers = (
        " ".join(
            mention(reviewer["login"], user_ids)
            for reviewer in pr["requested_reviewers"]
        )
        or "미지정"
    )
    mentioned = _body_mentions(pr, user_ids)
    return framed(
        "새 PR",
        f"{_pr_link(pr)}\n"
        f"{pr['user']['login']} · {pr['head']['ref']} → {pr['base']['ref']}\n"
        f"reviewer: {reviewers}" + (f"\nmention: {mentioned}" if mentioned else ""),
    )


def build_new_issue_message(issue: dict, user_ids: dict[str, str]) -> str | None:
    # public 레포라 팀원이 아닌 사람이 연 Issue 는 거른다.
    author = issue["user"]["login"]
    if author not in user_ids:
        return None
    mentioned = _body_mentions(issue, user_ids)
    return framed(
        "새 Issue",
        f"{_pr_link(issue)}\n{author}" + (f"\nmention: {mentioned}" if mentioned else ""),
    )


def build_review_request_message(pr: dict, login: str, user_ids: dict[str, str]) -> str:
    return framed(
        "리뷰 요청",
        f"👀 {mention(login, user_ids)} 리뷰 요청: {_pr_link(pr)} · {pr['user']['login']}",
    )


def opened_time(pr: dict, last_ready: datetime | None) -> datetime:
    created_at = datetime.fromisoformat(pr["created_at"])
    return max(created_at, last_ready) if last_ready else created_at


def is_late_review_request(
    pr: dict, requested_at: datetime, last_ready: datetime | None
) -> bool:
    # PR 생성·ready 직후 지정된 리뷰어는 새 PR 알림이 기다렸다가 함께 멘션한다(#41: ready 27초 뒤 5명 지정).
    # draft 에서 받은 요청은 ready_for_review 알림에서 멘션된다.
    return (
        not pr["draft"]
        and requested_at - opened_time(pr, last_ready) > REVIEWER_SETTLE_WINDOW
    )


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


def reminder_wait(nth: int) -> timedelta:
    return REVIEW_WAIT_THRESHOLD + REMIND_INTERVAL * nth


def due_reviewers(
    pr: dict,
    events: list[dict],
    action: str,
    login: str | None,
    now: datetime,
    nth: int = 0,
) -> list[str]:
    # reminder_wait(nth) 를 기다린 run 이 멘션할 리뷰어. 그 사이 재요청이나 ready 가 있었으면 그때 뜬 run 이 맡는다.
    wait = reminder_wait(nth)
    if pr["state"] != "open" or pr["draft"]:
        return []
    request_times = latest_request_times(events)
    last_ready = last_ready_time(events)
    waiting = [
        reviewer["login"]
        for reviewer in pr["requested_reviewers"]
        if reviewer["login"] in request_times
    ]
    if action == "review_requested":
        if login not in waiting:
            return []
        requested_at = request_times[login]
        # PR 과 함께 지정된 리뷰어는 opened·ready run 이 묶어서 멘션한다.
        if not is_late_review_request(pr, requested_at, last_ready):
            return []
        return [login] if now - requested_at >= wait else []
    if now - opened_time(pr, last_ready) < wait:
        return []
    return [
        reviewer
        for reviewer in waiting
        if not is_late_review_request(pr, request_times[reviewer], last_ready)
    ]


def build_reminder_message(
    pr: dict, logins: list[str], user_ids: dict[str, str], nth: int = 0
) -> str:
    reviewers = ", ".join(mention(login, user_ids) for login in logins)
    bangs = "!" * 2 * (nth + 1)
    return framed(
        "리마인드",
        f"{bangs}리뷰 요청 후 {reminder_wait(nth) // timedelta(hours=1)}시간이 지났습니다.{bangs}\n"
        f"{pr['user']['login']}님의 PR {_pr_link(pr)}: {reviewers}",
    )


def mentioned_logins(texts: list[str], user_ids: dict[str, str]) -> list[str]:
    # 팀원만 남긴다. 코드 조각의 @Transactional 같은 어노테이션이 멘션으로 잡히지 않는다.
    team = {login.lower(): login for login in user_ids}
    logins: list[str] = []
    for text in texts:
        for handle in re.findall(r"(?<![A-Za-z0-9])@([A-Za-z0-9-]+)", text):
            login = team.get(handle.lower())
            if login and login not in logins:
                logins.append(login)
    return logins


def build_review_notification(
    item: dict, actor: str, review: str | None, texts: list[str], user_ids: dict[str, str]
) -> str | None:
    kind = "PR" if "base" in item else "Issue"
    # main 대상은 운영진 notify-discord 워크플로가 알리고, public 레포라 팀원이 아닌 사람의 글은 거른다.
    if (kind == "PR" and item["base"]["ref"] == "main") or actor not in user_ids:
        return None
    mentions = [login for login in mentioned_logins(texts, user_ids) if login != actor]
    mentioned = " ".join(mention(login, user_ids) for login in mentions)
    author = item["user"]["login"]
    if actor == author:
        if not mentions:
            return None
        return framed(
            "멘션 알림",
            f"{mentioned}\n"
            f"{author}의 {kind} {_pr_link(item)}에서 {', '.join(mentions)}를 멘션했어요.",
        )
    head = f"{mention(author, user_ids)}\n{kind} {_pr_link(item)}에 {actor}의"
    tail = f"mention: {mentioned or '없음'}"
    if review is None:
        return framed("댓글 알림", f"{head} 댓글이 달렸습니다.\n{tail}")
    return framed("리뷰 알림", f"{head} 리뷰가 달렸습니다.\nreview: {review}\n{tail}")


def _github_request(
    url: str, token: str, payload: dict | None = None
) -> urllib.request.Request:
    return urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8") if payload else None,
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
    payload = {
        "content": content,
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
    if "issue" in event:
        return build_new_issue_message(event["issue"], user_ids)
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
    event: dict, repo: str, token: str, user_ids: dict[str, str], now: datetime
) -> tuple[str | None, dict | None]:
    api = f"https://api.github.com/repos/{repo}"
    if "inputs" in event:  # 후속 run (workflow_dispatch)
        inputs = event["inputs"]
        number, action, nth = int(inputs["pr"]), inputs["action"], int(inputs["nth"])
        login = inputs.get("reviewer") or None
    else:
        number, action, nth = event["pull_request"]["number"], event["action"], 0
        login = event.get("requested_reviewer", {}).get("login")
    pr = github_get(f"{api}/pulls/{number}", token)
    events = github_get_all(f"{api}/issues/{number}/events?per_page=100", token)
    logins = due_reviewers(pr, events, action, login, now, nth)
    if not logins:
        return None, None
    # 보낸 run 만 다음 run 을 띄운다. 보내지 않으면 반복이 여기서 끝난다.
    next_inputs = {
        "pr": str(number),
        "action": action,
        "reviewer": login or "",
        "nth": str(nth + 1),
    }
    return build_reminder_message(pr, logins, user_ids, nth), next_inputs


def dispatch_reminder(repo: str, token: str, ref: str, inputs: dict) -> None:
    url = f"https://api.github.com/repos/{repo}/actions/workflows/pr-review-reminder.yml/dispatches"
    urllib.request.urlopen(
        _github_request(url, token, {"ref": ref, "inputs": inputs}), timeout=30
    ).close()


def collect_review_notification(
    event: dict, repo: str, token: str, user_ids: dict[str, str]
) -> str | None:
    api = f"https://api.github.com/repos/{repo}"
    if "workflow_run" in event:
        # relay run 제목은 fork 에서 바꿀 수 있어서 번호만 받고 리뷰는 API 로 다시 조회한다.
        number, review_id = re.fullmatch(
            r"review #(\d+) (\d+)", event["workflow_run"]["display_title"]
        ).groups()
        review_url = f"{api}/pulls/{number}/reviews/{review_id}"
        review = github_get(review_url, token)
        comments = github_get_all(f"{review_url}/comments?per_page=100", token)
        actor = review["user"]["login"]
        label = REVIEW_STATE_LABELS[review["state"]]
        texts = [review["body"], *(comment["body"] for comment in comments)]
    else:
        number = event["issue"]["number"]
        actor = event["comment"]["user"]["login"]
        label = None
        texts = [event["comment"]["body"]]
        if "pull_request" not in event["issue"]:
            return build_review_notification(event["issue"], actor, label, texts, user_ids)
    pr = github_get(f"{api}/pulls/{number}", token)
    return build_review_notification(pr, actor, label, texts, user_ids)


def main() -> None:
    parser = argparse.ArgumentParser(description="팀 내부 PR·Issue 를 Discord 로 알린다.")
    parser.add_argument("command", choices=["notify", "remind", "review"])
    parser.add_argument(
        "--dry-run", action="store_true", help="기다리거나 전송하지 않고 출력만 한다"
    )
    args = parser.parse_args()

    # repo variable 이 없으면 Actions 가 빈 문자열을 넘긴다.
    user_ids = json.loads(os.environ.get("DISCORD_USER_IDS") or "{}")

    repo = os.environ["GITHUB_REPOSITORY"]
    token = os.environ["GITHUB_TOKEN"]
    now = datetime.now(timezone.utc)
    with open(os.environ["GITHUB_EVENT_PATH"], encoding="utf-8") as event_file:
        event = json.load(event_file)
    next_reminder = None
    if args.command == "notify":
        settle_seconds = 0 if args.dry_run else REVIEWER_SETTLE_WINDOW.total_seconds()
        content = collect_notification(
            event, repo, token, user_ids, now, settle_seconds
        )
    elif args.command == "remind":
        content, next_reminder = collect_reminder(event, repo, token, user_ids, now)
    else:
        content = collect_review_notification(event, repo, token, user_ids)

    if content is None:
        print("보낼 알림이 없습니다.")
    elif args.dry_run:
        print(content)
    else:
        post_discord(os.environ["TEAM_DISCORD_WEBHOOK"], content)
        if next_reminder:
            ref = event["repository"]["default_branch"]
            dispatch_reminder(repo, token, ref, next_reminder)


if __name__ == "__main__":
    main()
