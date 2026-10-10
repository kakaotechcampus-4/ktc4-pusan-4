# 디코봇: 알림 형식 통일, PR 본문 멘션, 새 Issue · Issue 댓글 알림

- 브랜치: `feature/discord-bot`
- 커밋: db495fa..d6006e1 (3개)
- 주요파일: `tools/pr_discord_bot.py`, `.github/workflows/pr-discord-notify.yml`, `tools/tests/test_pr_discord_bot.py`

## 한 일

- 모든 알림을 `-` 102개 구분선으로 위아래를 감싸고, 위 구분선 바로 아래에 제목을 단다 (`framed`).
  제목: `[새 PR]` `[새 Issue]` `[리뷰 요청]`(늦게 지정된 리뷰어) `[리마인드]`(24h·12h 반복)
  `[리뷰 알림]`(PR 리뷰) `[댓글 알림]`(PR·Issue 댓글) `[멘션 알림]`(작성자 본인 글의 팀원 태그).
- PR 코멘트는 `[리뷰 알림]` 의 `review: none` 대신 `[댓글 알림]` 으로 보내고 `review:` 줄을 뺐다.
  `build_review_notification` 의 `review` 가 `None` 이면 댓글이다.
- 새 PR 알림: 첫 줄의 `🆕 새 PR ` 접두어를 빼고(제목과 중복), `리뷰어:` 를 `reviewer:` 로 바꿨다.
  본문에서 태그된 팀원이 있으면 맨 아래에 `mention:` 줄을 붙인다(작성자 본인 제외, `_body_mentions`).
- 새 Issue 알림: `issues: [opened]` 트리거. `DISCORD_USER_IDS` 에 있는 팀원이 연 Issue 만, 링크·작성자·본문 `mention:` 줄.
- Issue 댓글: `review` job 이 PR 댓글로 한정하던 조건을 풀었다. `build_review_notification` 이 PR·Issue 를 함께 받고
  (`base` 유무로 구분), Issue 면 PR API 를 조회하지 않고 이벤트의 `issue` 를 그대로 쓴다.

## 왜 이렇게 했나

- 제목 4개(`새 PR`·`리뷰 알림`·`멘션 알림`·`새 Issue`)에 맞지 않는 알림이 있어 사용자와 정했다.
  리뷰 요청·리마인드·댓글은 각자 제목을 따로 두었다.
- 새 Issue 는 외부인을 거른다. public 레포라 누구나 Issue 를 열 수 있고, 댓글 알림이 외부인을 거르는 규칙과 같다.
  새 PR 은 지금처럼 거르지 않는다.
- 라벨은 기존 리뷰 알림의 `review:`·`mention:` 에 맞춰 영어로 통일했다. 값(`미지정`·`없음`)은 그대로다.

## 남은 것 · 아는 문제

- `issues` 트리거와 Issue 댓글 경로는 develop 에 머지돼야 실제로 돈다.
- Discord 에서 102자 구분선이 좁은 창·모바일에서 두 줄로 접히는지, `---` 줄이 서식으로 해석되지 않는지는
  실제 메시지로 확인해야 한다.
- 코퍼스 동기화 알림(`ai/pipeline/sync_report.py`)은 같은 웹훅을 쓰지만 이번 형식 변경 범위 밖이다.

## 검증

- `tools/tests/test_pr_discord_bot.py` pytest 49개, ruff check, actionlint(`pr-discord-notify.yml`·`pr-review-reminder.yml`) 통과.
- upstream 실제 데이터로 dry-run(전송 없음, 팀원 매핑은 가짜 ID):
  #105·#104 opened → `[새 PR]` 에 본문 멘션 줄. #108 → `[새 Issue]`, 작성자를 외부인으로 바꾸면 건너뜀(토큰 없이 API 미호출 확인).
  #103 Issue 댓글 → 남의 댓글 `[댓글 알림]`, 작성자 본인 태그 `[멘션 알림]`. #99 PR 댓글(봇·멘토·멘토만 태그한 작성자) → 모두 건너뜀.

## 22:01 구분선 51자로

- 커밋: b2e3a48
- 구분선 `DIVIDER` 를 `-` 102개에서 51개로 줄였다. 사용자 요청(절반). 위 기록의 102개는 이 시점부터 51개다.
- pytest 49개, ruff 통과.

