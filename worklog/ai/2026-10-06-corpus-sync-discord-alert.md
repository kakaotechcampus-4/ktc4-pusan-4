# 코퍼스 주간 동기화 결과·영향 카드 디스코드 알림

- 브랜치: feature/connect-syncpipline
- 커밋: a67a805..7489815 (5개, upstream/develop 머지 1개 포함)
- 주요파일: ai/pipeline/sync_report.py, deploy/corpus-sync.sh, docs/deployment.md, CONTEXT.md

## 한 일

- `pipeline.sync_report` (a67a805)
  - 이번 런의 새 버전(`fetched_at >= since`), sweep 이 닫은 조문(`effective_to = 런 날짜`이면서 후속 행 없음), 재색인 청크(`indexed_at >= since`)를 모은다
  - `rules/cards/R-*.yaml` 의 카드 인용과 선택지 인용(`question.options[].citations`)을 모아, 인용 조문 자신이나 하위가 바뀐 카드를 찾는다
  - 메시지는 머리 줄 + 코드 스니펫 2개다. 영향 카드(`수정된 조문 참조:` / `삭제된 조문 참조:`)와 변경사항(법령·행정규칙은 시행일별 조문 번호, 해석례·심판례는 새 문서)
  - 스니펫별로 잘라 1,900자 안에 넣는다. `TEAM_DISCORD_WEBHOOK` 이 없거나 `--dry-run` 이면 출력만 한다
  - `pyyaml` 을 dev 에서 런타임 의존성으로 옮겼다
- `corpus-sync.sh` (e7294a1)
  - 런 시작 시각을 `since` 로 남기고, 실패한 단계를 `failed` 배열에 모은다
  - 마지막에 `sync_report` 를 돌린다. 서버 repo 의 `rules/` 를 컨테이너 `/rules` 에 읽기 전용으로 붙인다
  - `compose.yaml`·`production.env.example` 에 `TEAM_DISCORD_WEBHOOK`, `docs/deployment.md` §6 에 3단계와 영향 카드 기준을 적었다
- CONTEXT §9·§9-1·§12 의 동기화 서술을 현재 구조로 고쳤다 (c180e81)
  - GH Actions cron 일 1회 → EC2 timer 주 1회, 조건부 재색인 → 매번
  - 러너 IP 문단 → timer 를 고른 이유, 판례 API 승인 상태
- 웹훅 URL 끝에 `?thread_id=` 를 붙여 스레드로 보내는 형식을 문서·워크플로 주석에 적었다 (8e3949c)
- upstream/develop(#83 Langfuse) 머지. `pyproject.toml` 의존성 충돌은 둘 다 남기고 `uv lock` 을 다시 돌렸다 (7489815)

검증:
- ai pytest 121 통과(새 테스트 7개 포함), ruff 통과, compose config 검사 통과
- 로컬 9/29 리허설 데이터 dry-run: 법령 387(개정 380·신설 7), 행정규칙 개정 91·신설 8·삭제 8, 해석례 4·심판례 16 으로 리허설 기록과 같다. 메시지는 1,683자
- 디스코드 스레드로 테스트 2건 전송 성공(예시 데이터, 9/29 데이터)

## 왜 이렇게 했나

- 변경이 없어도, 실패해도 보낸다. 10/4 까지 타이머가 한 번도 안 돈 걸 몰랐다. 알림이 없으면 멈춘 것이다
- 영향 판정에서 상위 조문은 보지 않는다. 조 본문은 항·호를 다 품어서 호 하나만 바뀌어도 조 행이 새로 생긴다. 상위까지 맞추면 33-1-5 를 인용한 카드 25장이 매번 걸린다
- 카드를 고치는 로직은 없다(사용자 확인). 카드는 git 파일이고, 자동 PR 을 만드는 규칙 후보 추출은 아직 없다. 알림은 검토 대상만 알린다
- `rules/` 는 ai 이미지 빌드 컨텍스트 밖이라 마운트로 읽는다. 서버 repo 는 배포된 커밋이라 카드와 코드가 어긋나지 않는다
- 새 파일로 둔 이유: law_sync 는 대상마다 다른 컨테이너에서 돌아서 런 전체와 실패 목록을 볼 프로세스가 없다
- PR 알림과 같은 웹훅을 쓰되 스레드를 나눈다(사용자 결정). GitHub secret 은 서버로 넘어가지 않으니 서버 env 에 따로 넣는다

## 남은 것 · 아는 문제

- 운영 반영 절차
  - develop → release 배포
  - 서버 `/etc/ktc4/production.env` 에 `TEAM_DISCORD_WEBHOOK=<웹훅>?thread_id=1556822868560584724` 를 추가한다
  - `systemctl start ktc4-corpus.service` 로 전체 경로를 확인한다
- PR 봇을 새 서버 스레드로 옮기는 건 GitHub secret `TEAM_DISCORD_WEBHOOK` 값만 바꾸면 된다(코드 변경 없음). 아직 안 바꿨다
- 항 머리말처럼 부모 문구만 바뀐 경우는 호를 인용한 카드에 잡히지 않는다
- 서버에서 `docker compose run -v` 로 `rules/` 가 붙는지는 아직 확인하지 않았다. shellcheck 는 로컬에 없어 돌리지 않았다
