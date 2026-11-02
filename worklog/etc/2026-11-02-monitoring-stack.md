# 모니터링 스택·Discord 알림 (B1)

- 브랜치: feature/monitoring-stack
- 주요파일: deploy/monitoring/template.yaml, deploy/monitoring/alarm_to_discord.py, deploy/monitoring/deploy.sh, docs/deployment.md

## 한 일

- `docs/monitoring_plan.md`(#220)의 B1. CloudFormation 스택 `ktc4-monitoring` 에 로그 그룹 `/ktc4/backend`(보존 14일), 알림 Lambda `ktc4-alarm-to-discord`, EC2 알람 2개(CPU, 상태 검사)를 넣었다.
- Lambda 는 알람 이벤트를 한국어 메시지(상태·이전 상태·이유·콘솔 링크)로 바꿔 Discord 웹훅으로 보낸다. 표준 라이브러리만 쓰고 단위 테스트 7개를 붙였다.
- `docs/deployment.md` 에 13절 "로그"(A3 몫, 제목만)와 14절 "모니터링"(배포·알림 확인)을 만들었다.

## 왜 이렇게 했나

- Lambda 코드를 템플릿에 인라인하지 않고 파일로 둬 테스트한다. 대신 `cloudformation package` 가 zip 을 S3 에 올려야 해서 배포 스크립트가 버킷을 받는다.
- `/ktc4/backend` 는 `DeletionPolicy: Retain`. 스택을 실수로 지워도 로그는 남는다.
- Lambda 로그 그룹을 미리 만들어 보존 기간을 건다. 자동 생성 그룹은 무기한이다.
- 기본 `Python-urllib` User-Agent 는 Discord 가 403 으로 막아 User-Agent 를 지정했다(`tools/pr_discord_bot.py` 와 같은 이유).

## 남은 것 · 아는 문제

- 실제 배포와 `set-alarm-state` 로 Discord 도착 확인은 아직. SSO 역할의 CloudFormation·Lambda·IAM·S3 권한이 실제로 되는지도 그때 확인한다.
- 호출 권한의 `SourceArn` 은 `alarm:ktc4-*` 와일드카드다. B3 알람 이름도 `ktc4-` 로 시작해야 한다.
- 단위 테스트는 CI 에 걸지 않았다. `python3 -m unittest discover -s deploy/monitoring` 로 돌린다.
