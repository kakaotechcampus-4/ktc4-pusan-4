# 되묻기 API 안내

되묻기 API의 계약 원본은 [`api.md`](api.md)다. 이 문서는 과거 초안과 전체 API 명세가 다시 갈라지는 것을 막기 위한 안내만 제공한다.

- `GET /api/v1/questions`: `api.md` 3.9
- `POST /api/v1/question-responses`: `api.md` 3.10
- `POST /api/v1/questions/bulk-answer`: `api.md` 3.11
- Question 취소 정책: `api.md` 3.12

주요 결정:

- 미해소 집계는 `unresolved: { count, amount }` 형태다.
- `amount`는 `PENDING` Question이 참조하는 Transaction을 중복 제거한 금액 합계다.
- 일괄 응답 범위는 요청한 `batchId`와 `factType`으로 제한한다.
- 일괄 응답 후 개별 정정은 기존 UserFact를 수정하지 않고 새 version을 생성한다.
