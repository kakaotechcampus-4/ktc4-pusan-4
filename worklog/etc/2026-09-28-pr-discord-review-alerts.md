# PR Discord 봇: 24시간 즉시 리마인드와 리뷰·코멘트 알림

- 브랜치: `feature/discord-bot`
- 커밋: c177313..ef8078c (2개)
- 주요파일: `tools/pr_discord_bot.py`, `.github/workflows/pr-review-reminder.yml`, `.github/workflows/pr-discord-notify.yml`

## 한 일

- 매일 10:07 요약 리마인드(cron)를 없애고, 리뷰 요청 후 24시간이 되는 시점에 보내도록 바꿨다. opened · ready_for_review · review_requested 마다 run 이 뜨고 environment `review-reminder` 의 wait timer 로 24시간 기다린 뒤, PR 을 다시 조회해 아직 리뷰하지 않은 리뷰어만 멘션한다.
- PR 과 함께(2분 안) 지정된 리뷰어는 opened·ready run 이 한 메시지로 묶고, 그 뒤 지정된 리뷰어는 자기 review_requested run 이 보낸다. 새 PR 알림의 `is_late_review_request` 규칙을 그대로 쓴다.
- 리뷰(approve / comment / request changes)나 PR 코멘트(none)가 달리면 작성자를 멘션하고, 본문과 줄 코멘트에서 태그된 팀원을 `mention:` 줄에 나열한다. 작성자 본인의 글은 팀원을 태그했을 때만 그 팀원에게 "멘션했어요" 형식으로 알린다.
- 대상은 기존과 같이 base 가 `main` 이 아닌 PR 이다 (스택 PR 포함). 새 워크플로 파일 없이 기존 두 파일만 고쳤다.
- 요약 리마인드 전용 코드(`find_stale_reviews`, `wait_start_times`, `split_message` 등)와 그 테스트를 지웠다.

## 왜 이렇게 했나

- 예약 실행이 두 번 다 약 5시간 늦게 시작했다 (9/24·9/25 모두 cron 10:07 KST, 실제 15:07 KST). cron 폴링으로는 "24시간이 되는 시점" 을 맞출 수 없다. job 안에서 sleep 하는 방법은 GitHub 호스트 러너의 job 한도(6시간)에 걸린다. environment wait timer 는 최대 30일까지 기다리고 대기 시간은 과금되지 않는다. `deployment: false` 로 배포 기록도 남기지 않는다.
- 상태를 저장하지 않는다. 깨어난 run 은 그 사이 재요청·ready 가 있었으면 24시간이 안 찬 것으로 보여 건너뛰고, 그때 뜬 run 이 맡는다.
- `pull_request_review` 는 fork PR 에서 secret 을 받지 못하고 `_target` 버전도 없다. 그래서 `pr-review-reminder.yml` 의 relay job 이 run 제목에 PR 번호·리뷰 ID 만 남기고, `pr-discord-notify.yml` 이 `workflow_run` 으로 받아 API 로 리뷰를 다시 조회해 보낸다. `issue_comment` 는 fork PR 이어도 기본 브랜치에서 돌아 바로 처리한다.
- 글쓴이와 멘션은 `DISCORD_USER_IDS` 에 있는 팀원만 남긴다. 코드 조각의 `@Transactional` 같은 어노테이션을 거르고, public 레포라 외부인 코멘트를 막으려는 것이다.
- 한 파일에 이벤트가 섞여 job 조건마다 `github.event_name` 을 확인한다. GitHub 조건식은 `null == false` 를 참으로 계산해서, 이 검사가 없으면 코멘트 이벤트에도 기존 `notify` 가 돈다.

## 남은 것 · 아는 문제

- upstream 에 environment `review-reminder`(wait timer 1440분)를 머지 전에 만들어야 한다. 없으면 GitHub 가 대기 없이 자동으로 만들어 리마인드가 조용히 빠진다. 이번 작업에서는 아직 만들지 못했다.
- 세 트리거(`pull_request_target`·`workflow_run`·`issue_comment`)가 모두 develop 의 파일로만 돌아서 실제 동작은 머지 후에 확인한다. fork 경로는 fork 에서 올린 PR 로 확인한다.
- 머지 전에 걸려 있던 리뷰 요청(#57·#55·#49)은 타이머가 없어 24시간 알림이 가지 않는다.
- 리마인더 run 이 끝날 때마다 `PR Discord notify` 에 skipped run 이 하나씩 생긴다. 새 파일 없이 relay 를 두느라 생긴 잡음이다.
- 24시간 값이 `REVIEW_WAIT_THRESHOLD` 와 environment 설정 두 곳에 있다.

## 검증

- `tools/tests` pytest 38개, ruff, actionlint 통과. actionlint 가 `run-name` 안의 ` #` 가 YAML 주석으로 잘리는 문제를 잡아 값을 따옴표로 감쌌다.
- upstream 실제 데이터에 가짜 이벤트로 dry-run 했다. 리마인드는 #55 ready → 전송, #55·#57 동시 지정 요청 → 건너뜀, #57 opened → 2명 묶음, #49 오늘 재요청 → 건너뜀. 리뷰 알림은 승인 리뷰 → 리뷰 형식, 작성자 답글·태그 없음 → 건너뜀, 일반 코멘트 → `review: none`, 작성자의 팀원 태그 → 멘션 형식, 외부인 → 건너뜀.
