# A1b 를 develop 위로 올리고 UserFact 소유자 복합 FK 추가

- 브랜치: feature/judgment-origin
- 커밋: d457376..bb3e7d2 (4개)
- 주요파일: V10__require_judgment_origin_and_fact_batch.sql, JudgmentSchemaIntegrationTest.java

## 한 일

- 10/6 에 로컬에서 끝낸 A1b(`d457376`, 기록은 2026-10-06-judgment-schema.md)를 origin/develop 위로 rebase 했다.
  - 코드 커밋은 충돌이 없었다. worklog 2026-10-06-judgment-schema.md 만 충돌해, develop 쪽(A1a 리뷰 반영 05:30 절)을 그대로 두고 A1b 절을 끝에 붙였다.
- 마이그레이션을 V8 에서 V10 으로 옮겼다(`e1cf530`).
- V10 에 `user_fact_batch_user_fkey` 를 추가했다(`bb3e7d2`). `(batch_id, user_id)` → `upload_batch(id, user_id)`, ON DELETE CASCADE.
  - 테스트 `user_fact_owner_must_match_batch_owner`: 다른 사용자의 batch 로 `UserFactPersistenceService.save` 하면 거부된다.
- Codex(gpt-5.6-sol, high) 리뷰를 받았다. 지적 3개 중 1개(위 복합 FK)를 반영했다.

## 왜 이렇게 했나

- V10: develop 에 V8(B2) 이 이미 있고, 열린 #117 이 V9 를 쓴다.
- 복합 FK
  - 10/6 A1b 기록의 "남은 것"이었다. B2 의 `upload_batch_id_user_id_key` 가 develop 에 들어와 이제 걸 수 있다.
  - Codex 지적: `save(userId, batchId, ...)` 가 두 값을 따로 받아, 다른 사용자의 batch 에 fact 가 붙어도 들어갔다.
  - transaction 의 V8 복합 FK 와 같은 방식으로, V7 의 단일 `batch_id` FK 는 그대로 뒀다.
- 반영하지 않은 지적
  - "기존 행이 있으면 V10 이 실패한다": #98 리뷰에서 채우지 않고 실패하게 두기로 합의했다. 운영 코드에 judgment·user_fact 를 쓰는 곳이 없다.
  - "origin 이 다른 batch·거래의 행을 가리켜도 저장된다": A1a 에서 커밋 때 검사(deferred FK)로 batch 삭제를 막기로 정했다(`batch_referenced_by_another_batchs_judgment_is_not_deleted`). DB 로 막으려면 `judgment.batch_id` 추가가 필요해 A1b 범위를 넘는다. origin 을 만드는 A2a·A4b·B8·A5 의 테스트에서 같은 batch 인지 확인한다.

## 확인한 것

- 새 테스트가 FK 추가 전에 실패("Expecting code to raise a throwable")하고, 추가 후 통과하는 것을 확인했다.
- `gradlew check` 통과. test 193개, integrationTest 47개.
- #98 에서 "A1b 때 확인하겠다"고 한 `JudgmentRunsMigrationUpgradeIntegrationTest` 가 V10 이 있는 상태에서 통과한다. 대상 버전을 설명으로 찾아 번호 변경에도 손대지 않았다.

## 남은 것 · 아는 문제

- #117(V9) 이 이 PR(V10)보다 먼저 merge 되어야 한다. 순서가 바뀌면 Flyway 가 V9 를 거부하므로 #117 번호를 바꾼다.
- 배포 전에 운영 DB 의 `judgment`·`user_fact` 행 수가 0 인지 확인한다.
- A2a·A2b(로컬 feature/judgment-executor, feature/judgment-runs)는 #88(B1b) 의 `BusinessContextService` 에 의존한다. #88 은 승인됐지만 `ApiResponseContractTest` 충돌로 머지 전이다.
