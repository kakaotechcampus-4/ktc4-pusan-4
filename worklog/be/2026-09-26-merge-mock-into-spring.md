# NestJS 목 서버를 Spring 고정 목 응답으로 통합

- 브랜치: refactor/merge-mock-into-spring
- 커밋: 4900956..d3f8fd4 (4개)
- 주요파일: JudgmentMockData.java, MockResponse.java, OpenApiConfig.java, ApiResponseContractTest.java

## 한 일

- 응답 타입이 `Map<String,Object>`로 남아 있던 7곳을 api.md 형태의 record로 바꿨다. 대상은 Context 조회·이력, 업로드 배치 목록·상세, 판정 목록, grouped=false 질문·분류 항목이다.
- 기능별 `*MockData` Bean 4개(`UserMockData`, `TransactionMockData`, `ClassificationMockData`, `JudgmentMockData`)가 27개 엔드포인트의 고정 응답을 만든다. 공용 id와 페이지 래퍼는 `MockFixtures`에 둔다.
- `@MockResponse`가 붙은 메서드는 스웨거 설명이 `[목 응답]`으로 시작한다(`OpenApiConfig`의 OperationCustomizer). 501 표시 커스터마이저, `ApiException.notImplemented()`, `ContractNotes`는 쓰는 곳이 없어져 지웠다.
- `ApiResponseContractTest`(@WebMvcTest)가 29개 요청의 상태 코드, `Map`이던 7곳의 응답 키 집합(api.md 예시 기준), 에러 형식(`code`·`message`·`traceId`)을 확인한다.
- `mock-server/`와 `docs/api-mock-implementation.md`를 지웠다. api.md에 문장으로 없던 규칙 두 가지를 옮겼다.
  - §1.5: `userInclusion`·`bookkeepingDuty`는 `{code,label}`이 아니라 값 그대로 응답한다.
  - §3.10: 같은 Batch·groupKey·factType의 다른 PENDING 질문도 함께 ANSWERED 처리하고, `answeredCount`에 포함한다.

## 왜 이렇게 했나

- PR #50 멘토 리뷰: 목 서버를 따로 두고 두 벌을 유지하는 비용이 크다. 스프링에서 하드코딩 응답을 내리고, 서비스 레이어를 구현하면서 실제 값으로 바꾸라는 제안이었다.
- 고정 응답으로 했다. idempotency·revision·cascade 같은 상태 규칙은 서비스에서 구현한다. 프론트(#39)는 자체 목을 쓰고 mock-server를 호출하지 않아서 흐름 상태가 필요하지 않았다.
- MockData를 Bean으로 둬서 서비스를 붙일 때 주입 타입과 호출부만 바꾸면 되게 했다. 인터페이스나 @Profile 전환은 두지 않았다. 엔드포인트 단위로 교체할 것이라 목과 실제를 오갈 일이 없다.
- 테스트는 값을 보지 않고 상태 코드와 키 집합만 본다. 서비스로 바꿔도 계약이 같으면 통과해야 한다.
- mock-server를 지우기 전에 두 서버를 띄워 27개 응답의 키 트리를 대조했다. 26개는 같았다. `POST /upload-batches`만 목 서버가 api.md §3.3보다 필드(sourceType, cardIssuer, periodStart, periodEnd)를 더 내려 주고 있었고, Spring은 api.md대로 두었다.

## 남은 것 · 아는 문제

- mock-server에만 있던 동작은 서비스를 구현할 때까지 비어 있다. 지금 Spring은 `Idempotency-Key` 누락을 api.md의 `400 IDEMPOTENCY_KEY_REQUIRED`가 아니라 `VALIDATION_ERROR`로 응답한다. `page=abc` 같은 값은 mock은 기본값으로 대체했지만 Spring은 400으로 응답한다.
- 서비스 구현 때 참고할 mock-server 테스트 5개. 이식하지 않았고 git 이력(15532d0^)에 있다:
  - `upload-idempotency.service.test.cjs`: 24h TTL, 삭제 후 410
  - `judgment-overrides.service.test.cjs`: 활성 Override 대체, 해제 후 복귀
  - `judgment-runs.service.test.cjs`
  - `questions.service.test.cjs`: 같은 scope 질문 함께 처리
  - `classification.service.test.cjs`: 배치가 다른 reviewId → 422
- 목 응답의 라벨 문자열은 api.md §2 표와 대조했지만 하드코딩이다. 법령 본문은 mock-server 시드를 옮겼고 원문과 대조하지 않았다.
- api.md §3.10에 추가한 "같은 scope 질문 함께 처리"는 mock-server 리뷰에서 정한 해석이다. 팀 확인이 필요하다.
- `backend/README.md`가 안내하는 `tools/run_backend_code_health.py`는 없는 파일이다(기존 문제, 이번에 손대지 않음).

## 01:23 Idempotency-Key 누락 에러 코드를 api.md 에 맞춤

- 커밋: 639e4eb
- `Idempotency-Key` 없이 업로드하면 Spring 기본 처리로 `VALIDATION_ERROR`가 나가고 있었다. api.md §3.3은 `400 IDEMPOTENCY_KEY_REQUIRED`다. 앞 기록의 "남은 것"에 적었던 불일치인데, 에러 형식 테스트가 틀린 코드를 고정하고 있었다.
- 헤더를 `required = false`로 받고 컨트롤러에서 직접 검사한다. 스웨거에는 `@Parameter(required = true)`로 필수 표시를 유지하고, 400 응답을 추가했다.
- 일반 검증 실패(`VALIDATION_ERROR`) 테스트는 필수 필드가 빠진 문진 요청으로 옮겼다.
- 스웨거 설명의 "현재 기준: PR #41 의 ce91429" 표기를 지웠다. api.md가 그 뒤로 바뀌어 낡은 표기였다.
- 목 응답은 입력 검증 에러(422 등)를 내지 않는다. 고정 응답이라 서비스 구현 때 넣기로 하고 PR #55 본문에 적었다.

## 20:38 답변 정정 때 같은 scope 의 ANSWERED 질문도 새 UserFact 로 옮김

- 커밋: 9f2924d
- PR #55 리뷰(memoryhong) 반영. 앞 기록에서 api.md §3.10에 넣은 형제 질문 문장이 `PENDING`만 대상으로 했다. 정정하면 4단계("Fact의 scope가 영향을 주는 Transaction 조회")에 따라 scope 거래 전체가 새 version으로 재판정되는데, 이미 `ANSWERED`인 형제 질문의 `answeredFactId`는 이전 version에 남았다. 같은 거래에서 Judgment는 새 UserFact를, Question은 옛 UserFact를 가리키게 된다.
- 형제 질문 대상을 `CANCELED`가 아닌 Question으로 넓혔다. `PENDING`이면 `ANSWERED`로 바꾸고, `ANSWERED`이면 `answeredFactId`와 `answeredAt`을 새 UserFact 기준으로 바꾼다. 정정 문단도 요청한 질문 하나가 아니라 같은 Batch·`groupKey`·`factType` Question을 모두 옮기도록 맞췄다.
- 옮기는 쪽으로 정한 이유: 정정 문단이 이미 요청한 질문의 `answeredFactId`를 바꾸고 있어서 이 필드는 "현재 답"을 가리킨다. 형제 질문은 처음부터 같은 scope 사실을 공유해서 답해진 것이다. 이전 답은 UserFact 이전 version 행과 Judgment revision의 `trigger_user_fact_id`에 남는다.
- 삭제한 mock-server `respond()`도 같은 구멍이 있었다. 형제를 `PENDING`만 골랐고 재판정할 거래도 질문에서 뽑아서, 정정 때 형제 거래가 재판정되지 않았다. 서비스 구현 때 `questions.service.test.cjs`를 참고하되 이 부분은 따르지 않는다.
- 코드 변경은 없다. `POST /question-responses`는 고정 목 응답이고, `answeredFactId`를 읽는 곳도 없다.
