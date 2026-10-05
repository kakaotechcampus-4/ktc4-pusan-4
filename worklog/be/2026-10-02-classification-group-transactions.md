# 분류 확인 그룹 응답에 건별 거래와 미해소 집계를 넣는다 (PR #63 후속)

- 브랜치: feature/classification-group-transactions
- 커밋: d66a723..68254f5 (3개)
- 주요파일: docs/api.md, ClassificationReviewGroupResponse.java, ClassificationUnresolved.java, ApiResponseContractTest.java

## 한 일

- `GET /classification-reviews?grouped=true` 의 그룹 항목에 필드를 추가했다(api.md 3.5).
  - `merchantNorm`: 그룹 제목용 정규화 이름
  - `transactions[]`: Review 마다 `reviewId`, `transactionId`, `approvedAt`, `merchantRaw`, `amount`, `installmentMonths`
  - 잘라내지 않고 전부 담는다. 정렬은 `approvedAt ASC, transactionId ASC` 다.
- 불변식을 넓혔다.
  - `count = reviewIds.length = transactions.length`
  - `totalAmount = Σ transactions[].amount`
- 규칙 문장을 적었다.
  - `groupKey` 는 형식을 보장하지 않으니 파싱하지 않는다.
  - `merchantRaw` 는 첫 거래 표기다.
- 응답 최상위에 `unresolved: {count, amount}` 를 넣었다. 3.9 Question 의 미해소 집계와 같은 모양이고, grouped 여부와 무관하게 항상 들어간다.
- BE 목업 응답 record 를 같은 모양으로 바꾸고 Swagger `@Schema` 설명을 달았다.
- `ApiResponseContractTest` 에 그룹 항목, `transactions[0]`, `unresolved` 키 집합 비교를 넣었다.

## 왜 이렇게 했나

- PR #63 의 FE 는 그룹, 개별 리뷰, 거래 목록을 따로 3번 받아 `reviewIds → transactionId` 로 조인한다. 그룹 응답에 건별 정보가 없어서다.
  - 리뷰 목록(기본 size 20)과 거래 목록(size 100)을 한 페이지만 받는다. 미분류가 그보다 많으면 건별 행이 조용히 빠진다.
  - 헤더의 "확인 필요 N건 · 금액" 은 현재 페이지 그룹의 합이라, 그룹이 한 페이지를 넘으면 틀린다. 그래서 `unresolved` 를 넣었다.
- `transactionIds` 만 추가하는 안은 버렸다. 여전히 거래 목록을 따로 불러야 하고, 페이지 크기 문제도 그대로 남는다.
- `reviewIds` 는 남겼다. `POST /classification-responses` 가 이 값을 그대로 받는다. 기존 필드를 그대로 두는 추가형 변경이라 지금 FE 는 깨지지 않는다.
- `judgment/api/Unresolved` 를 재사용하지 않고 `ClassificationUnresolved` 를 따로 뒀다.
  - Swagger 설명이 Question 기준이라 그대로 쓰면 틀린 설명이 나간다.
  - merchant 모듈이 judgment 모듈에 의존하게 된다.
- 계약 테스트를 먼저 넣어 새 케이스 4개가 실패하는지 확인한 뒤 record 와 목업을 고쳤다.

## 확인한 것

- `test` 전체 통과(ApiResponseContractTest 46개).
- `integrationTest` 통과. OpenAPI 생성과 경로 대조까지 포함한다.

## 남은 것 · 아는 문제

- FE 정리는 FE 담당 몫이다.
  - `ClassificationReviewGroup` 타입 갱신
  - `reviewsQ`·`txQ` 호출과 조인 제거
  - 헤더 합계에 `unresolved` 사용
- Swagger UI 는 앱을 띄워 직접 보지 않았다. 통합 테스트는 경로만 대조하므로, 새 필드 설명은 코드로만 확인했다.
- 실제 서비스 레이어가 없어 아직 목업 응답이다. 정렬, 불변식, 집계 필터 규칙은 구현할 때 테스트로 고정해야 한다.
