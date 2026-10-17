# A1b·A2a·A2b 를 develop 위로 다시 쌓는다

- 브랜치: feature/judgment-origin (#118) → feature/judgment-executor (A2a) → feature/judgment-runs (A2b)
- 커밋: ca8270e..1ec9433 (A2a 4개), A2b 2개
- 주요파일: application.yml, JudgmentExecutor.java

## 한 일

- feature/judgment-origin(A1b)을 develop(4198b1a, #88·#114·#116 포함)으로 rebase 했다. 충돌은 없었다.
- A2a 는 B2·B1b 브랜치를 로컬 merge 한 위에 있었다. merge 두 개를 버리고 A2a 커밋만 A1b 위로 cherry-pick 했다.
  - A2a 의 `V9__create_public_holiday.sql` 을 뺐다. develop 에 같은 표가 V6(#99)으로 이미 있다.
  - `HolidayCalendar` 는 develop 쪽을 그대로 쓴다. `publicHolidays()` 가 같은 모양이라 실행기 코드는 바뀌지 않았다.
  - "공휴일 조회를 리포지토리로 옮긴다" 커밋(edd108a)과 그 worklog 절은 빼고 옮겼다. 같은 리포지토리 구조가 #99 로 develop 에 들어 있다.
  - `application.yml` 은 `app.holiday`(#99)와 `app.rules`(A2a)를 한 `app:` 아래로 합쳤다.
- A2b 는 A2a 위로 그대로 cherry-pick 했다. 충돌은 없었다.
- 2026-10-06-judgment-schema.md 의 A2a 절에 적힌 "V9 public_holiday", "HolidayCalendar(JdbcTemplate)", "B2·B1b 로컬 merge" 는 rebase 전 상태다. 지금은 위 내용이 맞다.

## 확인한 것

- 세 브랜치 각각 `gradlew -p backend check` 통과. A2b 브랜치 기준 test 288, integrationTest 62(실행기 6, run 5 포함).

## 남은 것 · 아는 문제

- 마이그레이션 번호는 A1b 의 V10 이 #117(V9) 뒤를 전제한다. #117 이 먼저 merge 되어야 한다.
- rebase 전 브랜치는 backup/judgment-executor-pre-rebase, backup/judgment-runs-pre-rebase 로 로컬에 남겼다.

## 14:26 서버가 내려가 멈춘 run 을 실패로 끝낸다 (feature/judgment-run-interruption)

- 브랜치: feature/judgment-run-interruption (base: feature/judgment-runs)
- 커밋: 8f570f1 (1개)
- 주요파일: JudgmentRunService.java, JudgmentRunner.java, V11__add_judgment_run_last_progress_at.sql, JudgmentRunInterruptionIntegrationTest.java

### 한 일

- `judgment_run.last_progress_at`(V11, `NOT NULL DEFAULT now()`)을 추가했다. run 을 만들 때, 시작할 때, 거래 한 건을 성공·실패로 처리할 때마다 갱신한다.
- `JudgmentRunner` 의 `@Scheduled`(1분)가 `JudgmentRunService.interruptStale` 을 부른다.
  - 진행이 5분 넘게 없는 QUEUED·RUNNING run 을 잠그고, 남은 PENDING 항목을 `RUN_INTERRUPTED` 로 FAILED 처리한다.
  - run 은 `complete` 규칙대로 FAILED·PARTIAL_FAILED 로 끝난다.
- 실행기 쪽 `start`·`judgeItem`·`recordFailure`·`complete`·`fail` 은 run 행을 `PESSIMISTIC_WRITE` 로 잠그고 상태를 본다.
  - 이미 끝난 run 이면 아무것도 바꾸지 않는다. `judgeItem` 은 false 를 돌려주고 실행기는 거기서 멈춘다.
- api.md 3.6 failures 에 errorCode 표(`RULE_PROCESSING_FAILED`, `RUN_INTERRUPTED`)를 넣었다. architecture.md 의 "알려진 한계" 줄을 실제 동작으로 바꿨다.

### 왜 이렇게 했나

- 배포할 때마다 backend 컨테이너가 새로 뜨므로, run 이 RUNNING 으로 남는 일은 드물지 않다. 프론트는 끝나지 않는 run 을 계속 폴링한다.
- 이어 돌리지 않고 실패로 끝냈다(사용자 결정). 같은 run 이 프로세스를 죽이면 재시작마다 다시 잡는 고리가 생기지 않는다. 사용자는 실패를 보고 run 을 다시 만든다.
- 서버 기동 때 정리하는 안도 검토했다. 서버가 1대라면 가장 단순하지만, 여러 대가 되면 다른 서버의 살아 있는 run 까지 끝낸다. 진행 시각 기준이면 서버 수와 상관없이 맞다(사용자 결정).
- Redis 큐(B9a 이후)는 쓰지 않았다. run 은 Postgres 에 있어 큐와 한 트랜잭션으로 묶을 수 없으므로, 결국 Postgres 기준 정리가 따로 필요하다.
- 진행 시각을 따로 둔 건, 거래 한 건 판정이 짧고 건마다 커밋하기 때문이다. 5분 동안 진행이 없으면 죽은 것으로 볼 수 있다. 건마다 run 행을 이미 갱신하고 있어서 쓰기 횟수는 늘지 않는다.
- 잠금이 없으면, 정리 작업이 느린 run 을 끝낸 뒤 실행기가 FAILED 항목을 SUCCEEDED 로 덮어쓰거나 마지막 `complete` 가 상태를 다시 바꾼다.

### 확인한 것

- `JudgmentRunInterruptionIntegrationTest` 6개: 멈춘 RUNNING → PARTIAL_FAILED, 시작 못 한 QUEUED → FAILED, 최근 진행한 run 은 그대로, 끝난 run 에 실행기가 늦게 와도 덮어쓰지 않음, 끝난 QUEUED 는 시작하지 않음, 판정하면 진행 시각이 갱신됨.
- 일부러 깨 봤다. `judgeItem` 의 상태 확인을 지우면 덮어쓰기 테스트가, 성공 시 진행 시각 갱신을 지우면 진행 테스트가 실패한다.
- `gradlew -p backend check` 통과(test 288, integrationTest 68). PMD 19건은 기존과 같다.

### 남은 것 · 아는 문제

- QUEUED 도 같은 5분을 쓴다. 기본 스레드 풀(8개)보다 많은 run 이 몰려 5분 넘게 기다리면 실행 전에 끝날 수 있다.
- 서버가 내려간 뒤 정리될 때까지 최대 6분 정도는 RUNNING 으로 보인다.
- 다시 실행하면 이미 성공한 거래도 다시 판정되어 revision 이 하나씩 더 쌓인다.
- 이 변경을 #127 에 넣으면 PR 추가 줄 수가 1000줄을 넘는다(+1248). 따로 올릴지 정해야 한다.
