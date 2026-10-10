# 판정·질문 그룹 응답에 거래 요약, 일괄 답변 대상 여부, 답한 값을 더함 (#103)

- 브랜치: feature/judgment-question-response-fields
- 커밋: 951f5fe..a9a9569 (2개)
- 주요파일: docs/api.md, QuestionGroupResponse.java, JudgmentResponse.java, ApiResponseContractTest.java

## 한 일

- 거래 요약을 api.md 3.4 에 한 번 정의했다. 필드는 `approvedAt`, `merchantRaw`, `merchantNorm`, `merchantCategory`, `amount`, `installmentMonths` 이고 응답 시점의 거래 값이다.
  - 판정(목록, 상세, Override 응답)에는 `transaction` 객체로 붙였다.
  - 분류 확인 그룹(#74)과 질문 그룹의 `transactions[]` 에는 같은 필드를 펼쳐서 넣었다. 분류 확인 그룹에는 `merchantNorm`, `merchantCategory` 가 새로 들어갔다.
- 질문 그룹(3.9)에 `status`, `answer`, `bulkAnswerable`, `transactions[]`(`questionId`, `transactionId`, 거래 요약, `overridden`)를 넣었다. 그룹 단위를 "같은 Batch·groupKey·factType·status" 로 적었다.
- 개별 질문에 `answer` 를 넣었다. `ANSWERED` 가 아니면 `null` 이다.
- 일괄 응답(3.11)
  - 소명 대기 거래의 질문을 대상에서 뺀다. 기준은 "Override 를 뺀 최신 자동 판정이 불가인데 PENDING 질문이 남은 거래의 질문" 이다.
  - 뺀 질문은 `answer.value` 허용 검사(422)에도 넣지 않는다.
  - 뺀 수는 새 필드 `excludedCount` 로 센다.
- BE 목 응답 record, 목 데이터, `ApiResponseContractTest` 키 집합을 같은 모양으로 바꿨다. 거래 요약 키는 테스트에서 한 번 정의하고 세 곳이 그걸 쓴다.
- `rule-card-fields.md` 의 소명 대기 설명에 R-207 을 넣었다. 비통상 칸 표에서 생활용품을 "불가 + 질문" 으로 바로잡았다.
- `backend_api_plan.md` 의 A7 설명과 10/16 결정 항목을 이번 결정으로 바꿨다.

## 왜 이렇게 했나

- 거래 요약은 응답마다 따로 붙이되 필드는 하나로 맞췄다.
  - 여러 거래를 한 번에 조회하는 API 는 만들지 않았다. 판정 목록은 batch 필터와 제외 거래 처리 때문에 어차피 거래 테이블을 읽는다. 질문 그룹은 묶음 구성을 서버가 정한다. 둘 다 응답에 붙이는 쪽이 FE 호출과 조인 코드를 없앤다(#74 와 같은 이유).
  - 다만 #74, 판정, 질문 그룹이 서로 다른 필드를 고르기 시작해서 공통 정의를 뒀다.
  - `id` 는 넣지 않았다. 판정과 그룹 줄에 이미 `transactionId` 가 있다.
  - 그룹 줄은 펼친 모양을 유지했다. #74 를 객체로 바꾸면 지금 FE 가 깨진다.
- 일괄 응답 제외 범위를 주말 카드만이 아니라 소명 대기 전체로 잡았다(이슈 댓글에서 cho104 와 합의).
  - R-207 생활용품도 기본 불가 + 업무용이면 가능인 같은 구조다. 「업무용」은 R-104, R-211, R-303 에도 있어서 「용도 전부 업무용」 한 번으로 생활용품 불가가 소명 없이 풀린다.
  - 카드 목록으로 정하면 같은 구조의 카드가 생길 때마다 목록을 고쳐야 한다.
  - 별도 fact_type(`휴일용도`) 안은 쓰지 않았다. 그 fact_type 으로 일괄 응답하면 같은 문제가 남고, R-207 도 놓친다.
- "일괄 응답은 개인 쪽 답만 받는다" 안은 검토했지만 사용자가 거부했다.
- 거래 단위 기준이라 같은 거래의 다른 질문(R-060 증빙유무, R-241 자산여부)도 같이 빠지는데, 받아들였다.
  - 엔진은 소명 대기면 그 거래의 질문을 전부 남긴다(`JudgmentEngine`). `question_queue` 에는 선택지 효과가 저장되지 않아 질문 단위로 가를 수 없다.
  - 소명 답이 「개인」이면 불가가 확정되어 그 질문들은 취소된다. 불가를 푸는 답이면 거래가 소명 대기에서 벗어나 그 질문들이 일괄 대상이 된다. 그래서 소명을 먼저 받는 순서가 맞다.
  - 세금 쪽으로는 덜 빼는 방향의 위험이 없다. 일괄 응답을 덜 쓰게 될 뿐이다.
- 뺀 수를 `skippedCount` 에 더하지 않았다. "factType 이 달라 건너뜀" 과 섞이면 FE 가 이유를 나눠 보여줄 수 없다.
- 그룹 단위에 Batch 를 넣었다. `batchId` 없이 조회하면 다른 배치 질문이 한 그룹에 묶일 수 있는데, 3.10 은 다른 배치를 함께 받지 않고 답(UserFact)도 배치마다 다르다.
- 분류 그룹의 내부 record 이름을 `TransactionSummary` 에서 `ReviewTransaction` 으로 바꿨다. 공통 `TransactionSummary` 와 이름이 같으면 Swagger 스키마 이름이 겹친다. JSON 모양은 같다.

## 남은 것 · 아는 문제

- 실제 값은 구현 PR 에서 채운다(A3a 판정 조회, A4a 질문 조회, A7 bulk-answer). 지금은 목 응답이다.
- A4b(답변·재판정)를 구현할 때 "용도를 개인으로 답하면 같은 거래의 증빙 질문이 취소된다" 를 테스트로 고정해야 한다. 3.11 의 제외 이유가 이 동작에 기댄다.
- 지금 소명 대기 카드의 질문은 모두 `group_by: transaction` 이다. 가맹점 단위로 묻는 불가 + 질문 카드가 생기면, 같은 가맹점의 다른 거래에 일괄로 답한 UserFact 가 제외된 거래까지 풀 수 있다. 그때 3.11 규칙을 다시 봐야 한다.
- FE 는 바꾸지 않았다. 타입, 목업의 `skippedCount` 합산, 소명 대기면 일괄 답변을 막는 조건, 빠진 증빙 질문의 문구가 남아 있다.
- `ApiContractIntegrationTest` 는 OpenAPI 경로만 본다. 스키마 이름이 겹치지 않는지는 테스트로 확인하지 않았다.
- `test`(응답 형태 51건 포함)와 `integrationTest`(23건)는 통과했다.
