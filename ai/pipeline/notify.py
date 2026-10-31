"""규칙 후보 주간 실행(deploy/rule-candidates.sh)의 출력을 디스코드로 보낸다.

결과와 상관없이 늘 보낸다. 일요일 아침에 알림이 없으면 타이머나 스크립트가 멈춘 것이다.

사용:
    python -m pipeline.notify --failed "promote" < 실행로그
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime

from app.config import settings
from pipeline.sync_report import KST, LIMIT, _fence, post


def main() -> int:
    ap = argparse.ArgumentParser(description="규칙 후보 주간 실행 결과를 디스코드로 요약")
    ap.add_argument("--failed", default="", help="실패한 단계 이름, 공백으로 구분")
    args = ap.parse_args()

    head = [f"🧩 규칙 후보 주간 실행 · {datetime.now(KST).date()}"]
    if args.failed.split():
        head.append("⚠️ 실패: " + ", ".join(args.failed.split()))
    prefix = "\n".join(head) + "\n"
    lines = sys.stdin.read().splitlines() or ["출력 없음"]
    message = prefix + _fence(lines, LIMIT - len(prefix) - len("```\n\n```"))
    print(message)
    if settings.team_discord_webhook:
        post(settings.team_discord_webhook, message)
    return 0


if __name__ == "__main__":
    sys.exit(main())
