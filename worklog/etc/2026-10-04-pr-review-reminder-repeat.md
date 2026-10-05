# PR 리뷰 리마인드: 24시간 이후 12시간마다 반복

- 브랜치: `feature/dicord-bot`
- 커밋: 51ccba6 (1개)
- 주요파일: `tools/pr_discord_bot.py`, `.github/workflows/pr-review-reminder.yml`, `tools/tests/test_pr_discord_bot.py`

## 한 일

- 24시간 리마인드 뒤에도 리뷰하지 않으면 12시간마다 다시 멘션한다. 문장 앞뒤 느낌표가 2개씩 늘어난다
  (24시간 `!!…!!`, 36시간 `!!!!…!!!!`, 48시간 6개 …). 24시간 메시지에도 `!!` 가 붙도록 바뀌었다.
- 알림을 보낸 run 만 `workflow_dispatch` 로 같은 워크플로의 후속 run 을 띄운다. inputs 는 `pr`·`action`·`reviewer`·`nth` 이다.
  후속 run 은 environment `review-reminder-followup` 에서 12시간 잔 뒤 `24h + 12h × nth` 기준으로 같은 판정을 한다.
- `due_reviewers`·`build_reminder_message` 에 `nth`(기본 0)를 더했고, 기준 시간은 `reminder_wait(nth)` 로 계산한다.
  `collect_reminder` 는 메시지와 다음 run 의 inputs 를 함께 돌려주고, `main` 은 Discord 전송이 성공한 뒤에만 dispatch 한다.
- 워크플로에 `workflow_dispatch` 트리거와 `actions: write` 권한을 더했다. environment 이름은 이벤트에 따라 나눈다.
  후속 run 의 run-name 은 `remind #<PR> nth=<n>` 이다.

## 왜 이렇게 했나

- 9/28 에 cron 을 버린 이유(예약 실행이 약 5시간 늦음)가 그대로라서, environment wait timer 로 깨우는 방식을 이어서 썼다.
  job 하나는 12시간을 버틸 수 없어서, 보낸 run 이 다음 run 을 띄우는 사슬로 만들었다.
- 상태는 여전히 저장하지 않는다. 후속 run 이 받는 `nth` 로 기준 시간을 고정하기 때문에, 그 사이 재요청이나 ready 가 있었으면
  새 시점에서 잰 경과 시간이 항상 기준보다 짧다. 그래서 옛 사슬은 저절로 끊기고 새 run 이 이어받는다.
  `nth` 를 경과 시간에서 거꾸로 계산하면 재요청 뒤에 옛 사슬이 중복으로 보낼 수 있어서 inputs 로 넘긴다.
- GITHUB_TOKEN 이 만든 이벤트는 보통 새 run 을 띄우지 않지만 `workflow_dispatch` 는 예외라서 이 방식이 된다.
  ref 는 이벤트의 `repository.default_branch`(develop)를 쓴다.
- 새 워크플로 파일 없이 기존 `pr-review-reminder.yml` 만 고쳤다.

## 남은 것 · 아는 문제

- upstream 에 environment `review-reminder-followup`(wait timer 720분)를 만들어야 한다. 없으면 후속 run 이 바로 깨어나
  "아직 36시간 전" 으로 끝난다. 그러면 24시간 알림만 가고 반복이 조용히 빠진다(중복 전송은 없음).
  9/28 기록의 `review-reminder`(1440분)가 아직 없다면 그것도 함께 만들어야 한다.
- 반복 횟수 상한이 없다. 리뷰·close·draft 전환 전까지 계속 보내고, 10일째(240시간)에는 느낌표가 앞뒤 38개다.
- 머지 전에 이미 대기 중인 run 은 예전 코드로 깨어나서 24시간 알림만 보내고 사슬을 시작하지 않는다.
- 후속 run 이 끝날 때마다 `PR Discord notify` 에 skipped run 이 하나씩 더 생긴다.
- 12시간 값이 `REMIND_INTERVAL` 과 environment 설정 두 곳에 있다.
- 쓰기 권한이 있는 사람은 Actions 화면에서 `workflow_dispatch` 를 직접 실행할 수 있다. 기준 시간이 차지 않았으면 보내지 않는다.

## 검증

- `tools/tests/test_pr_discord_bot.py` pytest 37개(새로 7개: 36·48시간 메시지, 후속 판정 3종, 첫 run·후속 run 의 다음 nth),
  ruff check, actionlint 1.7.12 통과.
- upstream 실제 데이터에 가짜 `workflow_dispatch` 이벤트로 `collect_reminder` 를 돌렸다(전송·dispatch 없음).
  #73 opened 묶음 nth=4 → 72시간 메시지(느낌표 앞뒤 10개), 다음 nth=5. nth=5 → 아직 84시간 전이라 건너뜀.
  #77 ready 후 오늘 재요청 → 옛 사슬 끊김.
