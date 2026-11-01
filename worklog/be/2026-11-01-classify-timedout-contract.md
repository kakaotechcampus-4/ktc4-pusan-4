# 분류 API 계약에 timedOut 추가 (#197 리뷰)

- 브랜치: feature/classify-backend
- 커밋: 5b9589b (1개)
- 주요파일: docs/backend_api_plan.md

## 한 일

- `backend_api_plan.md` 의 10/16 분류 API 계약에 `timedOut` 을 적었다. AI 서버 `POST /classify/merchants` 응답에서 마감(8초)을 넘긴 merchantNorm 목록이다
- 백엔드 코드는 바꾸지 않았다
  - `results` 의 `null` 은 그대로라 `AiServerModelClassifier` 가 읽는 모양은 같다
  - `RestClient` 의 Jackson 은 모르는 필드를 무시하므로 새 필드가 와도 깨지지 않는다

## 왜 이렇게 했나

- #197 리뷰가 실패와 시간 초과를 구분해 달라고 했다. 백엔드가 나중에 다시 묻는 정책을 붙일 때 쓰라는 뜻이다
- AI 서버(PR2)가 이 필드를 더했으니, 계약 단일 원본인 이 문서도 같이 고쳤다

## 남은 것 · 아는 문제

- 시간 초과 가맹점을 다시 묻는 정책은 아직 없다
