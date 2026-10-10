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
