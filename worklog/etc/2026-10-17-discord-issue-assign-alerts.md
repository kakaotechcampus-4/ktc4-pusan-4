# 디코봇: 위 구분선 제거, 새 Issue Assignees 줄, 담당자 지정 알림

- 브랜치: `feature/discord-bot`
- 커밋: 30917e3..c6e1314 (3개)
- 주요파일: `tools/pr_discord_bot.py`, `.github/workflows/pr-discord-notify.yml`, `tools/tests/test_pr_discord_bot.py`

## 한 일

- `framed` 에서 위 구분선을 뺐다. 모든 알림이 `[제목]` 으로 시작하고 구분선은 아래에만 남는다. 사용자 요청.
- 새 Issue 알림: 작성자 줄과 `mention:` 줄 사이에 `Assignees:` 줄을 넣었다. 담당자는 `mention()` 으로 멘션하고
  (매핑이 없으면 `@login`), 담당자가 없으면 줄을 생략한다. 라벨은 사용자가 준 표기 그대로다
  (다른 줄은 소문자 `reviewer:`·`mention:`).
- 담당자 지정 알림: 트리거를 `issues: [opened, assigned]` 로 넓혔다. `[담당자 지정]` 으로 지정된 사람을 멘션한다.
  팀원이 아닌 사람, 스스로 맡은 경우(`sender` == `assignee`), Issue 생성 10초 안의 지정
  (`ASSIGNED_WITH_ISSUE_WINDOW`)은 건너뛴다. 지정 시각은 issue events API 에서 그 사람의 최신 `assigned` 이벤트로 보고,
  없으면 지금으로 친다.

## 왜 이렇게 했나

- Issue 를 만들며 담당자를 지정해도 `assigned` 이벤트가 따로 온다. upstream 실제 데이터에서 생성과 같은 초~2초 뒤에
  찍혔다(#112 6명, #144, #149). 이들은 새 Issue 알림의 `Assignees:` 줄로 이미 나가서 거른다.
  나중에 지정한 사례는 #123 약 4분, #110 8시간, #108 하루 뒤였다.
- 새 PR 처럼 새 Issue 알림을 2분 기다렸다가 묶지는 않았다. #123 처럼 몇 분 뒤 지정은 어차피 따로 나가고,
  새 Issue 알림만 늦어진다.
- 스스로 맡은 건 자기 자신을 멘션하게 돼서 뺐다. 댓글 알림이 작성자 본인 글을 알리지 않는 것과 같은 기준이다.

## 남은 것 · 아는 문제

- `issues: assigned` 트리거는 develop 에 머지돼야 실제로 돈다.
- PR 의 Assignees 지정은 알리지 않는다(Issue 만).
- 여러 명을 한 번에 지정하면 사람마다 메시지가 하나씩 간다.
- 생성 10초 안에 손으로 지정하면 어느 알림에도 나오지 않는다(데이터상 사례 없음).
- 새 Issue 알림에서 작성자가 스스로 담당자면 `Assignees:` 줄에서 본인도 멘션된다.

## 검증

- `tools/tests/test_pr_discord_bot.py` pytest 커밋마다 49→50→56개 통과, actionlint(`pr-discord-notify.yml`·`pr-review-reminder.yml`) 통과.
  ruff 는 기존 코드의 UP017(`timezone.utc`) 3건 말고 통과.
- upstream 실제 Issue 로 dry-run(전송 없음, 팀원 매핑은 가짜 ID): #123·#110·#108 → `[담당자 지정]`,
  #144·#112(생성 시 지정)·#149(생성 시 스스로 지정) → 건너뜀. 가짜 opened 이벤트로 `Assignees:` 줄 확인.
