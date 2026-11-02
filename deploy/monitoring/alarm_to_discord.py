"""CloudWatch 알람 이벤트를 Discord 웹훅 메시지로 바꿔 보낸다.

알람이 Lambda 를 직접 호출한다(SNS 없음). 이벤트 모양:
https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html#alarms-and-actions-Lambda

표준 라이브러리만 쓴다. 배포는 deploy/monitoring/deploy.sh.
"""

import json
import os
import urllib.parse
import urllib.request

# Discord 메시지 본문 한도는 2000자다. 머리말·링크 몫을 남기고 이유를 자른다.
CONTENT_LIMIT = 2000
REASON_LIMIT = 1200

STATE_LABELS = {
    "ALARM": "🚨 장애",
    "OK": "✅ 복구",
    "INSUFFICIENT_DATA": "❔ 데이터 없음",
}


def console_url(region: str, alarm_name: str) -> str:
    name = urllib.parse.quote(alarm_name, safe="")
    return (
        f"https://{region}.console.aws.amazon.com/cloudwatch/home"
        f"?region={region}#alarmsV2:alarm/{name}"
    )


def build_payload(event: dict) -> dict:
    data = event["alarmData"]
    name = data["alarmName"]
    state = data["state"]["value"]
    previous = data.get("previousState", {}).get("value", "?")
    reason = data["state"].get("reason", "")
    description = data.get("configuration", {}).get("description") or ""
    region = event.get("region", "ap-northeast-2")

    if len(reason) > REASON_LIMIT:
        reason = reason[: REASON_LIMIT - 1] + "…"

    lines = [f"**{STATE_LABELS.get(state, state)}** `{name}`"]
    if description:
        lines.append(description)
    lines.append(f"상태: {previous} → {state}")
    lines.append(f"이유: {reason}")
    lines.append(f"<{console_url(region, name)}>")
    content = "\n".join(lines)[:CONTENT_LIMIT]

    return {
        "content": content,
        "allowed_mentions": {"parse": []},  # @everyone·역할·사용자 멘션 모두 막는다
        "flags": 4,  # 링크 미리보기(embed) 끄기
    }


def post_discord(webhook_url: str, payload: dict) -> None:
    request = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload).encode("utf-8"),
        # 기본 Python-urllib User-Agent 는 Discord 앞단에서 403 으로 막힌다(tools/pr_discord_bot.py 와 같은 이유).
        headers={
            "Content-Type": "application/json",
            "User-Agent": "ktc4-alarm-to-discord",
        },
        method="POST",
    )
    urllib.request.urlopen(request, timeout=8).close()


def should_notify(event: dict) -> bool:
    # 알람을 새로 만들거나 지표가 처음 들어오면 INSUFFICIENT_DATA → OK 로 바뀐다. 장애가 있었던 게 아니라 알리지 않는다.
    # INSUFFICIENT_DATA → ALARM 은 처음부터 문제라는 뜻이라 알린다.
    data = event["alarmData"]
    previous = data.get("previousState", {}).get("value")
    return not (previous == "INSUFFICIENT_DATA" and data["state"]["value"] == "OK")


def handler(event, context, post=post_discord):
    name = event["alarmData"]["alarmName"]
    state = event["alarmData"]["state"]["value"]
    if not should_notify(event):
        return {"alarm": name, "state": state, "sent": False}
    # 실패하면 예외를 그대로 올린다. 비동기 호출이라 Lambda 가 두 번 더 재시도하고, 실패는 Lambda 로그에 남는다.
    post(os.environ["DISCORD_WEBHOOK_URL"], build_payload(event))
    return {"alarm": name, "state": state, "sent": True}
