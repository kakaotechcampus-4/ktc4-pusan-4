# 판정 실행·이력 테이블과 삭제 정책 (A1a)

- 브랜치: feature/judgment-schema
- 커밋: 7b789ab (1개)
- 주요파일: V7__judgment_runs_and_delete_policy.sql, JudgmentSchemaIntegrationTest.java, QuestionQueueEntity.java, docs/architecture.md

## 한 일

- 마이그레이션 V7 (docs/backend_api_plan.md A1a)
  - 새 테이블 4개
    - `judgment_run`: 상태 5종, 건수 3개, context_id·context_version
    - `judgment_run_item`: PK (run_id, transaction_id), 상태 PENDING/SUCCEEDED/FAILED, `processed_at`
    - `classification_review`: PENDING/RESOLVED
    - `judgment_override`: 거래당 활성 하나를 부분 UNIQUE 로 보장
  - `judgment`
    - origin FK 4개(`run_id`, `trigger_user_fact_id`, `classification_review_id`, `judgment_override_id`)를 nullable 로 추가하고 각각 인덱스를 걸었다.
    - `state` 를 지웠다.
    - `transaction_id` FK 를 CASCADE 로 바꿨다.
  - `question_queue.status` 를 `대기/응답/취소` 에서 `PENDING/ANSWERED/CANCELED` 로 옮겼다. 값, DEFAULT, CHECK 두 개를 모두 바꿨다. `answered_fact_id` FK 는 CASCADE 로 바꿨다.
  - `user_fact.batch_id` 를 nullable 로 추가하고 → `upload_batch` CASCADE 를 걸었다.
  - `app_user` 를 참조하는 FK 5개(`user_context`, `upload_batch`, `user_fact`, `merchant_dict`, `limit_bucket_entry`)를 CASCADE 로 바꿨다.
- `QuestionQueueEntity` 의 상태 문자열을 영문 code 로 바꿨다.
- 통합 테스트 4개를 추가했다.
  - batch 삭제: 파생 테이블 12개가 모두 0 이 되고, `user_context`·`statute_version` 은 남는다.
  - 탈퇴: 파생 행, Context, 개인 사전이 지워지고 전역 사전과 법령은 남는다.
  - 거래당 활성 override 는 하나만 허용된다.
  - 질문 상태 CHECK 가 새 값으로 동작한다.
  - 기존 테스트의 질문 상태 단언은 영문 code 로 바꿨다.
- docs/architecture.md 에 "삭제 정책" 절을 추가했다.

## 왜 이렇게 했나

- 추가만 하고 조이지 않았다.
  - origin "정확히 하나" CHECK 와 `user_fact.batch_id NOT NULL` 은 A1b 에서 건다.
  - 지금 `JudgmentService.save`·`UserFactPersistenceService.save` 와 테스트 헬퍼는 그 값 없이 INSERT 한다. 지금 걸면 A1a 에 저장 코드 수정이 섞인다.
- `state` 삭제와 질문 상태 값 변경은 롤백해도 안전하다(db/README.md 호환 표).
  - 운영 코드는 judgment·question_queue·user_fact 에 쓰지 않는다. save 를 부르는 곳이 테스트뿐이다.
  - `state` 는 엔티티가 매핑하지 않는다.
- `judgment_run_item` 에 내부 상태 PENDING 을 뒀다. run 을 만들 때 대상 거래를 고정해 두려는 것이다. 실행할 때 다시 고르면, 그사이 제외·분류가 바뀌어 totalCount 와 처리 대상이 어긋날 수 있다. API 는 SUCCEEDED/FAILED 만 보인다.
- `processed_at` 을 넣었다. `/failures` 응답의 `failedAt` 을 담을 컬럼이 api.md §7 목록에 없다.
- `judgment_override.transaction_id` 를 넣었다. api.md 목록에는 없지만 "거래당 활성 하나" 를 DB 가 보장하려면 이 테이블에 거래 컬럼이 있어야 한다.
- origin FK 와 `answered_fact_id` 도 CASCADE 다.
  - 판정 이력은 append-only 라 origin 행이 지워지는 건 같은 batch 가 지워질 때뿐이다.
  - `answered_fact_id` 를 SET NULL 로 두면 "ANSWERED 면 fact 필수" CHECK 와 부딪힌다.
- `judgment_run.context_id` 도 CASCADE 다.
  - 처음엔 NO ACTION 으로 뒀다. 탈퇴 테스트가 `judgment_run_context_id_fkey` 위반으로 실패했다. 연쇄 삭제가 `user_context` 를 run 보다 먼저 지우려 했다.
  - Context 는 새 버전만 쌓이고 탈퇴 때만 지워지므로 CASCADE 로 바꿨다.
- api.md §6 은 탈퇴 때 무엇을 지우는지 정하지 않았다. B6 의 `DELETE /users/me` 가 루트 행 하나만 지우면 되도록 FK 를 맞췄다. 전역 `merchant_dict` 와 `statute_version`, 사용자 FK 가 없는 `rule_candidate` 는 남는다.

## 확인한 것

- 로컬 Postgres 17
  - 기존 제약 이름을 V1~V5 적용 결과에서 직접 확인했다.
  - V1~V5 위에 질문 3행(대기/응답/취소)과 판정을 넣고 V7 을 적용했다. 값이 PENDING/ANSWERED/CANCELED 로 옮겨졌고 `state` 가 사라졌다. `app_user` 삭제가 끝까지 연쇄됐다.
- `test`·`integrationTest` 전부 통과(199개).
- 일부러 깨 봤다. `judgment.transaction_id` 의 CASCADE 를 빼면 삭제 테스트 2개가 실패한다.

## 남은 것 · 아는 문제

- 마이그레이션 번호 V7 은 B2(#84, V6)가 먼저 merge 된다는 가정이다. 순서가 바뀌면 merge 직전에 develop 최신 +1 로 바꾼다.
- B2 도 `JudgmentSchemaIntegrationTest` 를 고친다(거래 삽입 헬퍼). 먼저 merge 되는 쪽 뒤에서 충돌을 풀어야 한다.
- 뒤 PR(A1b, A2a, A2b)을 로컬에서 이어 구현하며 이 스키마를 검증하는 중이다. 바뀔 수 있는 곳은 `judgment_run_item` 의 PENDING 과 `judgment_override.transaction_id` 다.
- docs/architecture.md "구현 범위" 의 "판정 영속성 미착수" 는 이미 낡았다. mock 교체 PR 에서 고치기로 한 계획대로 손대지 않았다.

## 05:30 Codex 리뷰 반영: 참조 FK 는 커밋 때 검사, 업그레이드 테스트 (A1a)

- 커밋: 1개
- 주요파일: V7__judgment_runs_and_delete_policy.sql, JudgmentSchemaIntegrationTest.java, JudgmentRunsMigrationUpgradeIntegrationTest.java, docs/architecture.md

### 한 일

- Codex(gpt-5.6-sol, high) 리뷰를 받았다. 지적 3개 중 2개를 반영했다.
- 참조 FK 를 `ON DELETE CASCADE` 에서 `NO ACTION DEFERRABLE INITIALLY DEFERRED` 로 바꿨다.
  - 대상은 judgment origin 4개, `judgment_override.source_judgment_id`, `question_queue.answered_fact_id` 다.
  - 소유 FK(batch → 거래 → 판정, batch → run 등)는 그대로 CASCADE 다.
- 테스트 `batch_referenced_by_another_batchs_judgment_is_not_deleted`: 다른 batch 의 run 을 가리키는 판정이 있으면 그 batch 삭제가 거부되고, 판정과 batch 가 남는다.
- 테스트 `JudgmentRunsMigrationUpgradeIntegrationTest`: V5 스키마에 판정, 질문(대기/응답/취소), fact 를 넣고 이 마이그레이션을 적용한다.
  - 상태 변환, 행 보존, `state` 삭제, 그 뒤 batch 삭제 연쇄를 확인한다.
  - 대상 버전은 파일 설명("judgment runs and delete policy")으로 찾는다. merge 직전에 번호를 바꿔도 테스트를 고치지 않아도 된다.
- docs/architecture.md 삭제 정책을 "소유 FK 만 CASCADE, 참조 FK 는 막고 커밋 때 검사" 로 고쳤다.

### 왜 이렇게 했나

- 리뷰 지적: 참조 FK 가 CASCADE 면 잘못 이어진 참조 하나(코드 버그)가 다른 batch 의 판정 이력을 조용히 지운다. 지금 코드는 같은 batch 안에서만 잇지만, 버그가 생기면 데이터 손실로 번진다.
- 즉시 검사하는 NO ACTION 으로 바꾸니 batch 삭제는 됐지만 탈퇴가 실패했다(`judgment_trigger_user_fact_id_fkey`). 탈퇴는 사용자 → UserFact 와 사용자 → batch → 거래 → 판정 두 경로로 함께 지우는데, UserFact 가 먼저 지워질 때 남은 판정에 걸린다. 그래서 커밋 때 검사(DEFERRABLE INITIALLY DEFERRED)로 했다. 정상 삭제는 통과하고 잘못된 참조만 막힌다.
- 업그레이드 테스트: 기존 테스트는 빈 DB 에만 적용해서 기존 행 변환과 제약 재생성을 보지 못했다. 손으로 한 번 확인했지만 회귀를 막지 못한다는 지적이다.
- 반영하지 않은 지적 1개: "V7 이 V6(B2)보다 먼저 배포될 수 있다". merge 직전에 develop 최신 +1 로 번호를 바꾸는 절차로 해결한다(사용자와 합의).

### 확인한 것

- `test`·`integrationTest` 전부 통과(204개).
- 일부러 깨 봤다. origin `run_id` 를 다시 CASCADE 로 바꾸면 교차 참조 테스트가 실패한다.

## 01:20 판정 origin 저장과 UserFact batch 범위 (A1b, feature/judgment-origin)

- 브랜치: feature/judgment-origin (base: feature/judgment-schema)
- 커밋: a2e4160 (1개)
- 주요파일: SaveJudgmentCommand.java, JudgmentEntity.java, UserFactPersistenceService.java, V8__require_judgment_origin_and_fact_batch.sql

### 한 일

- `JudgmentOrigin`·`JudgmentOriginType` 을 `judgment.api` 에서 `judgment.domain` 으로 옮겼다.
- `SaveJudgmentCommand` 가 `origin` 을 필수로 받는다. 두 번째 필드이고, null 이면 생성자가 거부한다.
- `JudgmentEntity` 가 FK 컬럼 4개를 매핑한다. origin type 에 맞는 컬럼 하나만 채운다.
- UserFact 를 batch 범위로 바꿨다.
  - `save`, `findLatest`, `findAllLatest`, 채번이 batchId 를 받는다.
  - `answerQuestion` 은 질문 → 판정 → 거래에서 batch 를 찾아 쓴다(`QuestionQueueRepository.findBatchId`).
- V8
  - `judgment_has_one_origin` CHECK 를 걸었다.
  - `user_fact.batch_id` 를 NOT NULL 로 바꿨다.
  - UNIQUE 를 `(user_id, batch_id, scope_key, fact_type, version)` 으로 교체했다.
  - `idx_user_fact_latest` 를 지웠다. 같은 열 순서인 UNIQUE 인덱스가 대신한다.
- 테스트
  - 헬퍼가 run origin 을 갖게 했다. `insertRun` 이 batch 소유자의 새 Context 버전으로 run 을 만든다.
  - 추가: origin 0개·2개 거부, USER_FACT origin 이 `trigger_user_fact_id` 에만 저장되는지, 다른 batch 의 fact 는 읽지 않고 버전도 따로 매기는지, 답변 fact 가 질문의 batch 에 저장되는지.

### 왜 이렇게 했나

- origin 타입을 domain 으로 옮긴 건 저장(persistence)과 API 응답이 같은 타입을 쓰게 하려는 것이다. persistence 가 api 패키지에 기대지 않는다. B1b 가 `BookkeepingDuty` 를 옮긴 것과 같은 방식이다.
- V8 은 기존 행을 채우지 않고 실패하게 뒀다. 기존 판정이나 fact 에 붙일 origin·batch 를 지어낼 근거가 없다. 운영 코드는 아직 두 테이블에 쓰지 않으므로 행이 없을 것으로 본다.
- `user_fact` 의 `(batch_id, user_id)` 가 같은 사용자인지는 DB 가 보장하지 않는다. B2 의 `upload_batch(id, user_id)` UNIQUE 가 아직 develop 에 없어서 복합 FK 를 걸 수 없다. 지금은 호출하는 쪽(A4b)이 batch 소유를 확인해야 한다.

### 확인한 것

- `test`·`integrationTest` 전부 통과(204개).
- 일부러 깨 봤다. CHECK 를 `>= 0` 으로 바꾸면 `judgment_requires_exactly_one_origin` 이 실패한다.

### 남은 것 · 아는 문제

- 배포 전에 운영 DB 의 `judgment`·`user_fact` 행이 0 인지 확인해야 한다.
- B2 가 merge 되면 `user_fact (batch_id, user_id)` 를 `upload_batch(id, user_id)` 에 복합 FK 로 묶는 것을 검토한다.

## 02:40 거래 한 건을 판정해 저장하는 실행기 (A2a, feature/judgment-executor)

- 브랜치: feature/judgment-executor (base: feature/judgment-origin + B2 feature/transaction-schema + B1b feature/business-context 로컬 merge)
- 커밋: 84e62bb (1개, merge 2개 제외)
- 주요파일: JudgmentExecutor.java, RuleSetConfiguration.java, HolidayCalendar.java, V9__create_public_holiday.sql

### 한 일

- `RuleSetConfiguration`: 기동 시 `app.rules.dir`(기본 `../rules`)에서 카드를 한 번 읽어 `RuleSet` 빈으로 둔다. 읽지 못하면 부팅이 실패한다.
- V9 `public_holiday(holiday_date PK, name, fetched_at)` 와 `HolidayCalendar.publicHolidays()`(JdbcTemplate). 표를 채우는 동기화는 A2h 다.
- `JudgmentExecutor`
  - `judge(transactionId, BusinessContext, origin)` 를 한 트랜잭션으로 처리한다.
    1. 거래를 `TransactionInput` 으로 바꾼다.
    2. 그 batch 의 최신 UserFact, 공휴일 집합과 함께 엔진 5인자 `judge` 를 부른다.
    3. `JudgmentService.save` 로 저장한다(taxYear·시행일 = 승인일).
    4. 같은 거래의 다른 revision 에 남은 PENDING 질문을 CANCELED 로 바꾼다.
  - Context 의 사용자가 거래의 사용자와 다르면 거부한다.
  - `rejudge(userId, transactionIds, origin, contextVersion)`: `BusinessContextService.version` 으로 Context 를 찾아 거래마다 `judge` 를 부른다. 호출한 쪽 트랜잭션에 묶인다.
- `BusinessContextService.version(userId, version)` 을 추가했다(B1b 코드). 없으면 404 `CONTEXT_NOT_FOUND`.
- `TransactionRecordEntity` 에 접근자와 `toInput()` 을, 리포지토리에 `findById` 를 추가했다(B2 코드).
- rules_commit_sha
  - `app.rules.commit-sha` 의 기본값은 `local` 이다.
  - Dockerfile 이 `ARG RULES_COMMIT_SHA` 를 `ENV APP_RULES_COMMIT_SHA` 로 넘기고, `APP_RULES_DIR=/app/rules` 를 둔다.
  - aws-release 의 backend 이미지 빌드에 `--build-arg RULES_COMMIT_SHA="$GITHUB_SHA"` 를 붙였다.
- 통합 테스트 `JudgmentExecutorIntegrationTest` 6개를 실제 카드(../rules)로 돌린다.
  - 평일 카페 → R-300 확인필요, 질문 PENDING, run origin, context 버전, commit sha 가 남는다.
  - 2025-10-09 를 공휴일 표에 넣으면 R-312 불가로 바뀌고 이전 질문이 CANCELED 된다.
  - 다른 batch 의 fact 는 쓰지 않는다. 같은 batch 의 업무미팅 fact 가 있으면 가능·접대비다.
  - `rejudge` 는 요청한 버전을 쓰고, 없는 버전이면 404 다.
  - 조문이 없으면 예외가 나고 아무것도 저장되지 않는다.
  - 다른 사용자의 Context 는 거부한다.

### 왜 이렇게 했나

- 실행기를 `judgment.persistence` 에 뒀다. 거래 엔티티와 질문 리포지토리가 package-private 이고, `JudgmentService` 도 여기 있다.
- 대기 질문 취소는 `JudgmentService.save` 가 아니라 실행기에서 한다. save 는 override revision(A5)도 만드는데, override 가 질문을 취소해야 하는지는 아직 정하지 않았다.
- `rejudge` 는 건별 트랜잭션이 아니라 호출한 쪽 트랜잭션에 묶었다. 질문 응답·분류 응답은 "fact 저장 + 재판정" 이 함께 성공하거나 함께 실패해야 한다. run 은 A2b 에서 건별로 `judge` 를 따로 부른다.
- 공휴일은 매 판정마다 표 전체를 읽는다. 1년에 20건 안팎이라 캐시를 두지 않았다.
- `rules_commit_sha` 용도: 판정 당시 rules/ 전체를 git checkout 으로 되찾기 위함이다(CONTEXT.md L1302). 카드 version 만으로는 그때 어떤 카드들이 함께 있었는지 알 수 없다. `.git` 이 dockerignore 라 빌드 인자로 넘긴다(사용자 결정).

### 확인한 것

- `test`·`integrationTest` 전부 통과(225개).
- 일부러 깨 봤다. 엔진에 공휴일 대신 빈 집합을 넘기면 휴일 테스트가 실패한다.
- `docker build -f deploy/backend.Dockerfile --build-arg RULES_COMMIT_SHA=abc123` 이미지를 확인했다.
  - 환경변수 `/app/rules abc123`, 카드 51장.
  - 빈 Postgres 에 붙여 띄웠다. V1~V9 를 적용하고 기동했다(규칙 로드 포함).

### 남은 것 · 아는 문제

- 공휴일 집합은 rules_commit_sha 로 복원되지 않는다. 같은 SHA·같은 거래라도 공휴일 표가 바뀌면(임시공휴일 추가) 재판정 결과가 달라진다.
- 운영 `statute_version` 이 `law_sync.py` 로 채워져 있지 않으면 인용이 있는 판정은 모두 실패한다. 배포 전에 확인해야 한다.
- B2·B1b 브랜치를 로컬 merge 한 상태다. 두 PR 이 리뷰로 바뀌면 이 브랜치부터 다시 맞춰야 한다.

## 03:40 java -jar 기동 시 rules 경로 변환 실패를 고친다 (A2a 후속)

- 커밋: 1개
- 주요파일: RuleSetConfiguration.java

### 한 일

- `@Value("${app.rules.dir}") Path` 주입을 `String` 으로 받아 `Path.of` 로 바꾸게 했다.

### 왜 이렇게 했나

- A2h 를 실제 키로 확인하려고 `java -jar` 로 띄우니 부팅이 실패했다. "The resource path [/../rules] has been normalized to [null]".
  - Spring 이 문자열을 `Path` 로 바꿀 때 리소스 경로로 먼저 해석하는데, jar 안에서는 상대 경로 `../rules` 를 만들지 못한다.
- 테스트(@SpringBootTest, 압축 안 푼 클래스패스)와 이미지(절대 경로 `/app/rules`)에서는 드러나지 않았다. 로컬 `bootJar` 실행에서만 걸린다.

### 확인한 것

- `bootJar` 로 만든 jar 를 backend/ 에서 빈 Postgres 에 붙여 띄웠다. 기동했다.
- `test`·`integrationTest` 전부 통과.

## 04:40 judgment-runs API 를 실제 비동기 실행으로 바꾼다 (A2b, feature/judgment-runs)

- 브랜치: feature/judgment-runs (base: feature/judgment-executor. A2h 는 들어 있지 않다)
- 커밋: ea077ba (1개)
- 주요파일: JudgmentRunService.java, JudgmentRunner.java, JudgmentRunController.java, JudgmentRunIntegrationTest.java

### 한 일

- `POST /judgment-runs`
  - batch 가 그 사용자 것이 아니면 404 `BATCH_NOT_FOUND`, Context 가 아니면 404 `CONTEXT_NOT_FOUND` 다(`BusinessContextService.find` 추가).
  - 대상을 `judgment_run_item` PENDING 으로 고정하고 run 을 QUEUED 로 저장한다. 202 다.
  - 대상 조건(`TransactionRecordRepository.findRunTargetIds`): CLASSIFIED 이면서, 사용자가 제외하지 않은 JUDGEABLE 이거나 사용자가 포함한 EXCLUDED. CANCELED_OFFSET 은 늘 빠진다.
- 실행: `JudgmentRunCreated` 이벤트를 `@TransactionalEventListener` + `@Async`(`AsyncConfiguration`, Boot 기본 실행기)로 받아 `JudgmentRunner` 가 돈다.
  1. `start`: RUNNING 으로 바꾸고 Context 를 읽는다.
  2. 거래마다 `judgeItem`(판정 저장 + 항목 SUCCEEDED + processed++)을 한 트랜잭션으로 처리한다.
  3. 예외가 나면 `recordFailure`(FAILED, `RULE_PROCESSING_FAILED`, 예외 메시지, failed++)를 새 트랜잭션에 남긴다.
  4. `complete` 로 끝낸다. 실패 0 이면 COMPLETED, 성공 0 이면 FAILED, 섞이면 PARTIAL_FAILED. 대상 0건은 COMPLETED 다.
  5. `start` 가 실패하면 `fail` 로 FAILED 가 된다.
- `GET /judgment-runs/{id}`, `/failures`(page 0 이상, size 1~100, `processed_at, transaction_id` 순)는 소유자가 아니면 404 `JUDGMENT_RUN_NOT_FOUND` 다.
- 목 교체: `@MockResponse` 를 지우고 `JudgmentMockData` 의 run 메서드 3개를 지웠다. 계약 테스트는 `@MockitoBean JudgmentRunService` 로 대신한다.
- 그 밖: `JudgmentRunStatus` 를 `judgment.domain` 으로 옮겼다. 도메인 record `JudgmentRun`·`JudgmentRunFailure`, `PageResponse.of(Page)`, `UploadBatchRepository`, 요청 `@NotNull` 을 추가했다.
- docs/architecture.md 에 "판정 실행(run)" 절을 넣었다.

### 왜 이렇게 했나

- 대상을 만들 때 고정한 건 실행 중 제외·분류 변경으로 `totalCount` 와 처리 대상이 어긋나지 않게 하려는 것이다(A1a 의 PENDING 설계를 그대로 썼다).
- 커밋 뒤에 실행해야 다른 스레드가 run 과 항목을 읽을 수 있다.
- 판정 저장과 항목 성공을 한 트랜잭션에 묶었다. 판정만 저장되고 항목이 PENDING 으로 남는 경우를 막는다. 실패 기록은 롤백 뒤 새 트랜잭션이어야 남는다.
- 상태 라벨(대기, 실행 중, 완료, 부분 실패, 전체 실패)은 API 레이어(`JudgmentRunResponse.status`)에서 붙인다. 도메인 enum 은 화면 문구를 모른다(`Coded` 주석).
- A1a 스키마는 바꿀 곳이 없었다. run 의 모든 컬럼, `processed_at`(failedAt), PENDING 을 그대로 썼다. `judgment_override.transaction_id` 는 A5 에서 검증된다.

### 확인한 것

- `test`·`integrationTest` 전부 통과(230개, A2h 테스트 제외).
- `JudgmentRunIntegrationTest`(실제 카드)
  - 거래 7건(대상 3) → totalCount 3, PARTIAL_FAILED(성공 2·실패 1), failures 에 도서 거래와 "소득세법-27-1".
  - 성공만이면 COMPLETED, 대상 0건이면 COMPLETED, 실패만이면 FAILED.
  - 남의 batch·Context·run 은 404 다.
- jar 를 띄워 curl 로 확인했다.
  - Context 생성 → run 생성 202(QUEUED, totalCount 2, 미분류 제외) → 폴링하면 PARTIAL_FAILED.
  - failures 페이지에 도서 거래가 있다.
  - size=0 이면 400, contextId 가 없으면 400 `VALIDATION_ERROR`, 없는 run 이면 404.

### 남은 것 · 아는 문제

- 실행 중에 서버가 내려가면 run 이 RUNNING 으로 남는다. 이어 돌리는 장치는 없다(버퍼 주간).
- 같은 batch 에 run 이 동시에 둘 돌 수 있다. revision 채번은 거래 락으로 직렬화되어 깨지지 않지만, 막을지는 api.md 에 없다.
- 항목 `saveAll` 은 id 를 직접 정하므로 건마다 select 후 insert 다. 거래 수백 건이면 생성 응답이 느려질 수 있다. 실측하지 않았다.
- 시각은 UTC(`Clock.systemUTC`)로 직렬화된다(`...Z`). api.md 예시는 +09:00 이다. 다른 API 와 함께 정할 문제라 그대로 뒀다.
