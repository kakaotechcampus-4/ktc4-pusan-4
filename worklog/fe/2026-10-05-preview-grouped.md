# 분류 확인을 그룹 응답 하나로 읽는다

#74 가 `GET /classification-reviews?grouped=true` 응답에 건별 거래와 미해소 집계를
넣어 줬다. 그 전까지 FE 가 세 응답을 받아 직접 잇던 것을 걷어냈다.

## 한 일

- `ClassificationReviewGroup` 에 `merchantNorm`·`transactions[]` 추가.
  `ClassificationReviewTransaction` 타입 신설
- `UnresolvedPage<T>` 를 두고 3.5·3.9 가 같이 쓴다. `QuestionPage<T>` 는 그 별칭으로
  남겼다(치오님 PR 세 개가 떠 있어 이름을 바꾸면 충돌한다)
- `classificationReviews.list`·`grouped` 가 `unresolved` 를 함께 준다
- 목업 `grouped` 가 건별 거래를 승인일 오름차순(같으면 transactionId 순)으로 담는다
- `ClassificationPreview` 에서 `reviewsQ`·`txById`·`reviewById`·`reviewsOf`·`rowsOf` 제거.
  **API 호출 4개 → 2개**

## 왜 이렇게 했나

**집계를 현재 페이지로 더하던 것이 진짜 버그였다.** 전에는 그룹 배열을 `reduce` 했다.
목업 기본 size 가 100 이라 가려져 있었고, 계약 기본값 20 으로 맞추자 드러났다.
`unresolved` 는 `page`·`size` 와 무관한 배치 전체 집계라(api.md 3.5) 이 문제가 없다.

재현으로 확인했다. 같은 데이터에 size 만 바꿔 요청한 결과:

| size | 받은 그룹 | unresolved(서버) | 페이지 합산(옛 방식) |
|---|---|---|---|
| 1 | 1/5 | 6건 389,200원 | 1건 33,000원 |
| 2 | 2/5 | 6건 389,200원 | 2건 80,000원 |
| 3 | 3/5 | 6건 389,200원 | 3건 212,000원 |
| 100 | 5/5 | 6건 389,200원 | 6건 389,200원 |

**조인을 없앤 것도 같은 이유다.** 전에 `merchantNorm` 으로 이었다가 카드사 트랙이
다른 같은 가맹점이 섞인 적이 있다(#63 리뷰). `reviewIds` 기준으로 고쳤지만, 그래도
거래를 따로 받는 쪽에 `size: 100` 이 박혀 있어 그 위는 조용히 빠졌다. 이제 서버가
그룹마다 거래를 전부 담아 주므로 둘 다 사라진다.

계약 불변식도 응답에서 직접 확인했다 — `count = reviewIds.length = transactions.length`,
`totalAmount = Σ transactions[].amount`, 승인일 오름차순. 5개 그룹 전부 만족.

## 남은 것 · 아는 문제

- `POST /classification-responses` 응답에는 아직 `unresolved` 가 없다
  (`{resolvedCount, merchantCategory, judgedCount}`). 그래서 업종을 고른 뒤 헤더를
  갱신하려면 `grouped` 를 다시 부른다. #74 에 응답에도 넣어 달라고 리뷰를 남겼다
- 그룹이 100 개를 넘으면 목록은 잘리지만 헤더 숫자는 맞다. 페이지네이션 UI 는 아직 없다
