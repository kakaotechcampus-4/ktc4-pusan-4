# classification-reviews-query(#156) 에 develop 을 merge 하고 base 를 develop 으로 바꾼다

- 브랜치: feature/classification-reviews-query
- 커밋: 2df8bbb (merge 1개)
- 주요파일: MockFixtures.java

## 한 일

- base 였던 feature/transactions-api 가 #148 로 develop 에 들어가 base 를 develop 으로 바꿨다. develop(a7fb5a4)을 merge 했다. 뒤처진 develop 커밋은 219개다.
- `MockFixtures`: 이 브랜치는 목에서 실제 조회로 바꾸며 `UNCLASSIFIED_TRANSACTION_ID`·`REVIEW_ID` 를 지웠고, develop 은 #157(199dfee)에서 `OVERRIDE_JUDGMENT_ID`·`OVERRIDE_ID` 를 지웠다. 네 개 모두 지웠다. 남은 사용처는 없다.

## 왜 이렇게 했나

- 이미 push 된 브랜치라 rebase + force push 대신 merge 했다.

## 남은 것 · 아는 문제

- 리뷰 의견은 아직 반영하지 않았다. 두 `findRows` 에 `effectiveStatus` 가 JUDGEABLE 인 거래만 보이게 거는 것.
- #158(feature/classification-responses)은 이 브랜치 위에 쌓여 있어 이 merge 를 다시 받았다.

## 확인한 것

- `gradlew -p backend check` 통과(test 349, integrationTest 146, 스킵 0).

## 18:08 리뷰 반영: 판정 대상이 아닌 거래의 분류 확인 요청을 뺀다

- 커밋: 263120f
- `ClassificationReviewRepository` 의 두 `findRows` 에 effectiveStatus = JUDGEABLE 조건을 걸었다. 식은 `UploadBatchCountRepository` 의 분류 대기 수와 같다(JUDGEABLE 이고 제외 안 함, 또는 EXCLUDED 인데 사용자가 포함). 목록·그룹·미해소 집계가 모두 이 행을 쓰므로 함께 맞는다.
- #147 에서 정한 대로 검토 행은 지우지 않는다. 다시 포함하면 돌아온다.
- `docs/api.md` 3.5 GET 에 이 기준을 적었다.
- `ClassificationReviewIntegrationTest.excluded_transaction_reviews_are_hidden_until_included_again`: 제외한 거래의 요청이 batch 목록·전체 목록·집계에서 빠지고, 다시 포함하면 집계에 돌아오는지 본다. 조건 없이 실패하는 것을 먼저 확인했다.
- `gradlew -p backend check` 통과(test 349, integrationTest 147, 스킵 0).

## 18:46 #155 머지 뒤 develop 을 다시 merge 한다

- 커밋: d4ed5ee (merge)
- `ApiResponseContractTest`: 이 브랜치의 `ClassificationReviewService` 목과 #155 의 `AuthService` 목이 같은 자리에 들어가 충돌했다. 둘 다 남겼다.
- `gradlew -p backend check` 통과(test 360, integrationTest 152, 스킵 0).
