# api.md 에 추가된 에러 코드를 스웨거·예외 처리에 반영

- 브랜치: feature/swagger-error-codes (refactor/merge-mock-into-spring 위)
- 커밋: 기능 2개 + 이 기록
- 주요파일: ApiExceptionHandler.java, OpenApiConfig.java, 컨트롤러 7개, ApiResponseContractTest.java

## 한 일

- #42 이후 api.md 에 생긴 에러 코드를 엔드포인트 단위로 대조해 빠진 것을 `@ApiResponse` 로 붙였다.
  - 404 전용 코드: 배치 상세·삭제 `BATCH_NOT_FOUND`, 거래 상세·exclude·include `TRANSACTION_NOT_FOUND`, 판정 실행 `BATCH_NOT_FOUND`·`CONTEXT_NOT_FOUND`, Run 조회·failures `JUDGMENT_RUN_NOT_FOUND`, 판정 상세 `JUDGMENT_NOT_FOUND`, 분류 응답 `CLASSIFICATION_REVIEW_NOT_FOUND`, 질문 응답 `QUESTION_NOT_FOUND`, 법령 `STATUTE_NOT_FOUND`
  - 분류 응답 `422 REVIEWS_FROM_DIFFERENT_BATCHES`, 요약 `400 INVALID_SUMMARY_SCOPE`
  - 질문 응답 설명에 §3.10 "같은 scope 의 PENDING 질문도 함께 ANSWERED" 규칙을 적었다.
- 요약 API 는 `batchId`·`year`·`runId` 가 정확히 하나가 아니면 실제로 `400 INVALID_SUMMARY_SCOPE` 를 낸다.
- §1.3 공통 코드: `ApiExceptionHandler` 가 없는 경로를 `404 NOT_FOUND`, 예상 못 한 예외를 `500 INTERNAL_ERROR` 로 응답한다. 스웨거는 모든 API 에 400·401·500 공통 응답을 붙이고 첫 화면에 공통 코드 표를 넣었다.

## 왜 이렇게 했나

- 요약 스코프 검사는 입력만으로 판단할 수 있어 `IDEMPOTENCY_KEY_REQUIRED`(639e4eb)와 같은 이유로 목 단계에서 적용했다. 리소스 존재 여부(404)는 저장소가 있어야 알 수 있어 문서에만 적었다.
- 공통 응답은 컨트롤러마다 반복하지 않고 `OperationCustomizer` 로 붙였다. API 가 같은 상태 코드를 이미 적었으면 설명 뒤에 코드만 덧붙인다(예: 요약 400 = `INVALID_SUMMARY_SCOPE, VALIDATION_ERROR`).
- `TRANSACTION_NOT_FOUND` 는 §1.3 의 전용 404 목록에만 있고 거래 절에는 없다. 단건 거래 API 에 붙였다.

## 남은 것 · 아는 문제

- 빌드·테스트를 돌리지 못한 채 올렸다(작업 환경에서 Maven 저장소 접근 불가). CI 로 확인한다.
- §1.3 표에 없는 405·415 등은 HTTP 상태 이름(`METHOD_NOT_ALLOWED`)을 code 로 쓴다. api.md 에 넣을지 팀 확인 필요.
- `401 UNAUTHORIZED` 는 인증이 아직 없어 실제로는 나가지 않는다. 문서에만 있다.
- `POST /judgments/{id}/override` 는 api.md 에 에러가 없어 손대지 않았다. 없는 판정이면 `JUDGMENT_NOT_FOUND` 가 자연스럽다.
