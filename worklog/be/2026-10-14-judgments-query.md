# GET /judgments 와 /judgments/{id} 를 목에서 실제 조회로 바꾼다 (A3a)

- 브랜치: feature/judgments-query (base: feature/judgment-run-interruption, #128)
- 커밋: 97e2f53 (1개)
- 주요파일: JudgmentRepository.java, JudgmentQueryService.java, JudgmentRevision.java, JudgmentQueryIntegrationTest.java

## 한 일

- `JudgmentQueryService.get`·`list` 를 만들고 컨트롤러의 상세·목록 목을 걷었다. summary·override 는 아직 목이다.
- 목록은 `JudgmentRepository.findPage` 쿼리 하나다. 범위는 셋 중 하나다.
  - runId: 그 Run 이 직접 만든 판정. 지금 제외된 거래, 현재 판정이 아닌 revision 도 들어간다.
  - latestOnly=false: 모든 revision.
  - 현재 판정(§5): 활성 override 가 있으면 그 override revision, 없으면 override 가 아닌 최신 revision.
    거래를 지정하지 않으면 지금 판정 대상(분류 완료, 제외 안 됨)만 남긴다. 조건은 `findRunTargetIds` 와 같다.
- transactionId·batchId·year·verdict 는 모두 AND 로 건다. 모든 조회는 `transaction.user_id` 로 본인 것만 본다.
- 거래 요약·인용은 페이지 단위로 한 번에 읽어 붙인다(`findByIdIn`, `findRows`).
- `JudgmentEntity` 에 `final_amount`·`computed_at` 를 읽기 전용으로 매핑했다. 활성 override 를 보려고 `JudgmentOverrideEntity`(id, transaction_id, active)를 최소로 추가했다.
- `JudgmentMockData.judgments()`·`judgment()` 를 지웠다. `ApiResponseContractTest` 는 `@MockitoBean JudgmentQueryService` 로 본다.

## 왜 이렇게 했나

- api.md 에 없는 조합은 프론트 목(`frontend/src/api/mock/index.ts` 의 `judgments.list`)의 해석을 따랐다. 조건은 AND, 범위 조건이 없으면 본인 전체의 현재 판정이다.
- 프론트 목과 다르게 정한 것
  - latestOnly=false 는 transactionId 없이도 모든 revision 이다. backend_api_plan.md 의 "latestOnly=false 는 revision 이력을 조회한다" 를 따랐다(내 판단, PR 에서 확인 요청).
  - 현재 판정에 분류 완료 조건을 넣었다. 목에는 없지만 api.md §5 에 있다.
- runId 와 latestOnly 를 함께 보내도 400 으로 막지 않고 latestOnly 를 무시한다.
- `explanation` 은 null 이다. api.md 는 "RuleCard 의 reason" 이라 하지만 RuleCard 에 그 필드가 없다.
- override 생성은 A5 지만, 현재 판정 규칙은 override 를 빼고 정의할 수 없어 읽기만 먼저 붙였다.

## 확인한 것

- `JudgmentQueryIntegrationTest` 8개. 상세·batch 목록·override 우선은 목 상태(또는 override 규칙 전)에서 먼저 실패하는 것을 봤다.
- 처음부터 통과한 분기는 구현을 깨 봤다. runId 조건, history 분기, verdict 필터, year 범위, 목록 소유자 조건, 제외 거래 필터를 각각 지우면 해당 테스트가 실패한다.
- year 를 주면 500 이 나던 것을 테스트가 잡았다. `:yearStart is null` 의 타입을 Postgres 가 정하지 못했다(42P18). `cast(:yearStart as LocalDate)` 로 고쳤다.
- `gradlew -p backend check` 통과(test 288, integrationTest 76). PMD 19건은 기존과 같다.

## 남은 것 · 아는 문제

- `frontend/src/api/http.ts` 의 `judgments.list` 가 `latestOnly` 를 보내지 않는다. 상세 패널의 이력 조회가 실제 서버에서는 현재 판정만 받는다. 프론트에서 고쳐야 한다.
- 같은 날 be 기록(2026-10-14-statutes.md)은 다른 브랜치(feature/statutes)에 있어, 이어 쓰지 않고 새 파일로 남겼다.
