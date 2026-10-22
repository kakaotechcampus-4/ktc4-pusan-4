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

## 01:33 GET /judgments/summary 를 목에서 실제 집계로 바꾼다 (A3b)

- 브랜치: feature/judgments-summary (base: feature/judgments-query)
- 커밋: 0119a7e (1개)
- 주요파일: JudgmentSummary.java, JudgmentSummaryTest.java, JudgmentQueryService.java, JudgmentSummaryResponse.java

### 한 일

- `JudgmentQueryService.summary` 가 A3a 의 `findPage` 를 페이지 없이(`Pageable.unpaged()`) 불러 집계한다. batchId·year 는 현재 판정, runId 는 그 Run 이 만든 판정이다.
- 집계 규칙은 순수 도메인 `JudgmentSummary.of` 에 두었다.
  - byVerdict 는 판정이 없어도 세 verdict 를 모두 0 으로 넣는다. finalAmount 가 비어 있으면 0 으로 센다.
  - byAccount 는 AVAILABLE 이면서 계정이 있는 판정만 모은다. finalAmount 내림차순, 같으면 계정 이름순이다.
- scope 는 요청 값으로 만든다(BATCH·YEAR·RUN). `INVALID_SUMMARY_SCOPE` 검사는 그대로다.
- `JudgmentMockData.summary()` 를 지웠다.

### 왜 이렇게 했나

- 목록과 같은 쿼리를 쓰면 현재 판정 규칙(override 우선, 제외 거래 빼기)이 한 곳에만 있다. SQL 로 group by 하려면 같은 조건을 두 번 더 써야 한다.
- byAccount 를 AVAILABLE 만으로 한 것은 프론트 목(`judgments.summary`)과 같다.
- 금액이 같을 때 계정 이름순은 내 판단이다. 금액 계산(A6) 전이라 금액이 모두 0 이어서, 정하지 않으면 순서가 흔들린다.
- 다른 사용자의 batch·run 은 404 가 아니라 빈 집계다. 프론트 목, A3a 목록과 같다.

### 확인한 것

- `JudgmentSummaryTest` 2개, 목 상태 뼈대에서 먼저 실패하는 것을 봤다.
- `JudgmentQueryIntegrationTest` 에 batch·run 집계 1개. 목 상태에서 먼저 실패했고, 집계 대상을 모든 revision 으로 바꾸면 실패한다.
- `gradlew -p backend check` 통과(test 290, integrationTest 77). PMD 19건 그대로.

### 남은 것 · 아는 문제

- 대상 판정을 모두 읽어 Java 에서 합친다. 연도 단위로 수천 건이면 느릴 수 있다. 실측하지 않았다.

## 01:53 GET /questions 를 목에서 실제 조회로 바꾼다 (A4a)

- 브랜치: feature/questions-query (base: feature/judgments-summary)
- 커밋: adea050 (1개)
- 주요파일: QuestionQueryService.java, QuestionGroup.java, PendingTotal.java, QuestionQueryIntegrationTest.java

### 한 일

- `QuestionQueryService.find` 가 본인 거래에 걸린 질문을 상태와 상관없이 `createdAt, id` 순으로 돌려준다. 질문 → 판정 → 거래로 소유자를 본다.
  - 질문마다 거래 요약, 답한 값(UserFact value), 활성 override 여부, 소명 대기 여부를 한 번에 모아 읽어 붙인다.
  - 소명 대기: override 를 뺀 최신 자동 판정이 UNAVAILABLE 이고 PENDING 질문이 남은 거래(api.md 3.11).
- 묶기·집계는 순수 도메인이다.
  - `QuestionGroup.group`: 같은 batch·groupKey·factType·status 로 묶는다. 그룹 순서는 첫 질문 순서, 그룹 안은 approvedAt·transactionId 순. bulkAnswerable 은 PENDING 이면서 소명 대기 질문이 없을 때만 true.
  - `PendingTotal.of`: PENDING 질문 수, 거래 금액 합계(같은 거래는 한 번).
- 컨트롤러는 목록 전체로 미해소 집계를 낸 뒤 status 를 거르고, 묶고, 페이지를 자른다.
- `QuestionStatus` 를 `judgment.domain` 으로 옮겼다(#127 의 `JudgmentRunStatus` 와 같은 방식). 목 `questions()`·`questionGroups()` 를 지웠다.

### 왜 이렇게 했나

- 미해소 집계는 status·grouped·page 를 적용하기 전 목록으로 센다(api.md 3.9). 그룹 단위 페이지도 먼저 다 묶어야 해서 목록 전체를 읽고 Java 에서 자른다.
- 그룹 순서(첫 질문 순서)는 내 판단이다. api.md 에 없다.
- 사용자가 제외한 거래의 질문도 목록과 미해소 집계에 넣었다. api.md 에 빼라는 규칙이 없다.

### 확인한 것

- 단위 테스트 4개(`QuestionGroupTest` 3, `PendingTotalTest` 1), 빈 값 뼈대에서 먼저 실패하는 것을 봤다.
- `QuestionQueryIntegrationTest` 3개(목록·답·미해소, 그룹, 다른 사용자), 목 상태에서 먼저 실패했다.
- override 표시, 소명 대기(verdict 조건, 적용), 답 값, 소유자 조건, batch 조건을 각각 깨면 해당 테스트가 실패한다.
- `gradlew -p backend check` 통과(test 294, integrationTest 80). PMD 19건 그대로.

### 남은 것 · 아는 문제

- batch 하나의 질문이 수천 건이면 목록 전체를 읽는 비용이 커진다. 실측하지 않았다.

## 02:45 POST /question-responses 를 목에서 답변·부분 재판정으로 바꾼다 (A4b)

- 브랜치: feature/question-responses (base: feature/questions-query)
- 커밋: 1c36e82 (1개)
- 주요파일: QuestionAnswerService.java, QuestionQueueRepository.java, TransactionRecordRepository.java, QuestionAnswerIntegrationTest.java

### 한 일

- `QuestionAnswerService.answer` 가 한 트랜잭션에서 처리한다.
  1. 검증: 404 `QUESTION_NOT_FOUND` → 422 `QUESTIONS_FROM_DIFFERENT_BATCHES` → 409 `QUESTION_GROUP_MISMATCH` → 409 `QUESTION_NOT_ANSWERABLE`(취소) → 422 `INVALID_ANSWER_VALUE`. 빈 `questionIds` 는 400 `VALIDATION_ERROR`.
  2. `UserFactPersistenceService.save` 로 UserFact 새 version(사용자 락 먼저).
  3. 같은 Batch·groupKey·factType 의 CANCELED 아닌 질문을 모두 `recordAnswer` 로 새 UserFact 에 묶는다. PENDING 은 ANSWERED, ANSWERED 는 fact 를 옮긴다(09-26 결정).
  4. `JudgmentExecutor.rejudge` 를 origin USER_FACT 로 부른다. 질문 취소(7)·새 질문(8)은 executor 가 한다.
- 재판정 대상 = 형제 질문의 거래 ∪ (가맹점 단위 질문이면) 같은 batch·가맹점 거래 중 지금 판정 대상이면서 판정한 적이 있는 거래. 거래 id 순으로 판정한다.
- Context 는 형제 질문 판정의 `user_context_version` 중 가장 큰 값이다.
- 요청에 `@NotEmpty`·`@NotBlank`·`@Valid` 를 붙였다. 목 `answer()` 를 지웠다.

### 왜 이렇게 했나

- 재판정 대상을 api.md 3.10 4단계("Fact 의 scope 가 영향을 주는 Transaction")보다 좁혔다(사용자 결정).
  - run 과 같은 판정 대상 기준을 쓰고, 아직 run 이 돌지 않은 거래에 run 밖 첫 판정을 만들지 않는다.
  - 제외했다가 다시 포함한 거래는 옛 답 기준 판정이 남는데, api.md §8.6 은 포함·배제 수정 뒤 새 run 을 돌리는 흐름이라 그 run 이 최신 UserFact 로 다시 판정한다. 미분류 거래는 분류 확정 때 B8 이 재판정한다.
  - 09-26 기록에 "scope 거래 전체가 재판정" 이라는 표현이 있다. 형제 질문을 다룬 문맥이라 제외·미분류 거래는 다루지 않았다. PR 에 근거와 함께 적었다.
  - api.md 문장은 고치지 않았다(사용자 결정).
- 형제 질문의 거래는 판정 대상 조건 없이 늘 넣는다. 답이 바뀐 질문의 거래 판정만 옛 답으로 남지 않게 한다.
- Context 버전이 그룹 안에서 갈리면 가장 큰 값을 쓴다(사용자 결정). 409 로 막으면 사용자가 답할 방법이 없다.
- 거래 id 순 재판정: 같은 거래를 다루는 동시 응답이 거래 락을 같은 순서로 잡게 한다.
- 검증을 `findRequested`(404) 와 `validateAnswerable` 로 나눴다. 한 메서드면 PMD CyclomaticComplexity(11) 가 하나 늘었다.

### 확인한 것

- `QuestionAnswerIntegrationTest` 5개, 실제 카드(통신 R-205 가맹점 단위, 카페 R-300, 생활용품 R-207 + 적격증빙 R-060)와 실제 엔진으로 판정한다.
  - 첫 답변: 형제까지 ANSWERED, 판정한 가맹점 거래 3건 재판정, 판정 없는 거래는 그대로. 목 상태에서 먼저 실패했다.
  - 정정: 두 질문이 version 2 를 가리키고 판정이 불가로 바뀐다.
  - 제외·분류 풀린 가맹점 거래는 재판정하지 않고, Context 는 최신 버전을 쓴다.
  - 생활용품에 「개인」으로 답하면 불가가 확정되고 같은 거래의 증빙 질문이 취소된다(10-07 기록이 A4b 에 남긴 요구).
  - 잘못된 요청 6종은 UserFact 도 질문 상태도 바꾸지 않는다.
- 형제 범위, 가맹점 거래 포함, 판정 이력·분류·제외 조건, Context max, batch·취소·선택지 검사, executor 의 이전 질문 취소를 각각 깨면 해당 테스트가 실패한다.
- `gradlew -p backend check` 통과(test 294, integrationTest 85). PMD 19건 그대로.

### 남은 것 · 아는 문제

- 기존 `UserFactPersistenceService.answerQuestion`(질문 하나, PENDING 만)은 `JudgmentSchemaIntegrationTest` 가 써서 그대로 뒀다. 운영 코드에서는 쓰지 않는다.
- B7 포함(include) API 는 재판정하지 않는다. 다시 포함한 거래는 새 run 전까지 옛 답 기준 판정이다(api.md §8.6 흐름).
