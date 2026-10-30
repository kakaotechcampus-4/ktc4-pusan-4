# 분류 확인 목록을 실제 조회로 바꾼다 (B8a)

- 브랜치: feature/classification-reviews-query (feature/transactions-api 위)
- 커밋: 9db7d66..9db7d66 (1개)
- 주요파일: ClassificationReviewService.java, ClassificationReviewRepository.java, ClassificationController.java

## 한 일

- `GET /classification-reviews` 의 목을 실제 조회로 바꿨다. `ClassificationMockData` 에는 아직 목인 분류 응답(`answer`)만 남겼다.
- 목록은 `createdAt ASC, id ASC`. `grouped=true` 는 같은 `merchantNorm` 끼리 묶고 `groupKey = merchant:<merchantNorm>` 이다. 그룹 순서는 그룹의 첫 요청 순서, 그룹 안 거래는 `approvedAt ASC, transactionId ASC`.
- `unresolved` 는 batchId 만 적용한 PENDING 전부다. status·grouped·page·size 를 적용하지 않는다(api.md 3.5).
- `suggestedCategories` 는 빈 배열이다.
- 시각은 KST 로 되돌려 응답한다(api.md 1.2).
- 쓰는 곳이 없어진 `MockFixtures.REVIEW_ID`, `UNCLASSIFIED_TRANSACTION_ID` 를 지웠다.
- 테스트: `ClassificationReviewIntegrationTest` 2(목록 순서·페이지·status 와 무관한 미해소 집계·batch 필터, 그룹 묶음·그룹 단위 페이지·그룹 안 정렬). 계약 테스트는 서비스를 `@MockitoBean` 으로 대신한다.

## 왜 이렇게 했나

- batch 의 요청을 한 번에 읽어 메모리에서 거르고 자른다. 미분류 거래만 요청이 생겨 batch 당 수가 작고, grouped 의 page·size 가 그룹 단위라 SQL 로 자르기 어렵다. 미해소 집계도 같은 행에서 센다.
- 그룹을 `merchantNorm` 으로 묶은 이유: 분류 응답(B8b)이 개인 사전에 `merchantNorm` 을 pattern 으로 남기므로, 한 번 답하면 같이 풀릴 것끼리가 한 그룹이다.
- 그룹 안 거래의 `transactionId` 정렬은 문자열 비교다. `UUID.compareTo` 는 부호 있는 비교라 DB 순서와 다를 수 있다.
- `suggestedCategories` 를 비운 이유: 분류기가 제안 근거를 저장하지 않는다. 프론트는 이때 「다른 카테고리…」 선택만 보인다. 분류 AI(B10)가 붙으면 채운다.

## 확인한 것

- `gradlew -p backend check` 통과(단위 334, 통합 91).

## 남은 것 · 아는 문제

- 제외(EXCLUDED)된 거래의 대기 요청도 목록과 미해소 집계에 들어간다. api.md 3.5 가 PENDING 전부를 세고, B6 의 batch 분류 대기 수도 같은 기준이라 맞췄다. 거를지는 정해야 한다.
- 남의 batchId 를 주면 404 가 아니라 빈 목록이다. api.md 3.5 에 에러 정의가 없다.

## 02:33 분류 응답을 실제 처리로 바꾼다 (B8b)

- 브랜치: feature/classification-responses (feature/classification-reviews-query 위)
- 커밋: 60e2db3..60e2db3 (1개)
- 주요파일: ClassificationReviewService.java, ClassificationReviewRepository.java, MerchantDictionaryRepository.java, MerchantCategoryVocabulary.java

### 한 일

- `POST /classification-responses` 의 목을 실제 처리로 바꿨다. 이제 classification API 에 목이 없어 `ClassificationMockData` 를 지웠다.
- 처리: 요청 → RESOLVED(`selected_category`, `resolved_at`), 거래 → `merchantCategory` 확정·`CLASSIFIED`, 답을 개인 사전(`merchant_dict`, `source = user`, pattern = 거래의 merchantNorm)에 남긴다. 같은 pattern 이 있으면 덮어쓴다.
- 판정: batch 에 완료된 run(`COMPLETED`·`PARTIAL_FAILED`)이 없으면 `judgedCount = 0`. 있으면 가장 최근 완료 run 의 문진 버전으로, 해결한 거래 중 판정 대상(effectiveStatus = JUDGEABLE)만 다시 판정한다. origin 은 거래마다 그 거래의 요청(`CLASSIFICATION_REVIEW`)이다.
- 에러 검사 순서: 미분류 422 → 허용 어휘 밖 422 → 없거나 남의 요청 404 → 다른 batch 422 → 이미 해결 409. 하나라도 걸리면 아무것도 바꾸지 않는다.
- 허용 어휘는 `rules/categories.yaml` 을 읽는 `MerchantCategoryVocabulary` 빈이다.
- 요청과 거래 행을 잠근다. 같은 요청에 응답이 동시에 와도 한 번만 해결된다.
- 테스트: `ClassificationResponseIntegrationTest` 5(완료 run 없음 → 분류만·개인 사전·다음 업로드가 사전으로 분류됨, 완료 run 의 문진 버전으로 판정 대상만 재판정·origin, 카테고리 422 두 가지, 404 두 가지와 무변경, 다른 batch 422·이미 해결 409).

### 왜 이렇게 했나

- 완료 run 을 `COMPLETED`·`PARTIAL_FAILED` 로 잡았다. api.md 2.7 에서 둘 다 판정 결과를 남기고, `FAILED` 는 결과가 없다. 아직 도는 run 은 대상이 run 을 만들 때 고정돼 이 거래가 들어 있지 않다.
- run 의 문진 버전을 `ClassificationReviewRepository` 의 native 쿼리로 읽는다. `JudgmentRunEntity`·`JudgmentRunRepository` 가 트랙 A(#127)에만 있어서다. 두 스택이 develop 에 들어가면 그쪽으로 옮긴다.
- 제외된 거래의 요청도 해결은 하지만 판정하지 않는다. run 대상 조건(api.md 3.6)과 같다.

### 확인한 것

- `gradlew -p backend check` 통과(단위 334, 통합 96).

### 남은 것 · 아는 문제

- 개인 사전을 남기면 다음 업로드부터 같은 가맹점이 자동 분류된다. 이미 올라와 있는 다른 batch 의 같은 가맹점 대기 요청은 그대로 남는다.
