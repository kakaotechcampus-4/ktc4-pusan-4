# API 계약 테스트 목록에 질문 답 취소를 더한다

- 브랜치: fix/fe-feedback-1109
- 커밋: 7a79aa7f (1개)
- 주요파일: ApiContractIntegrationTest.java

## 한 일

- `ApiContractIntegrationTest` 의 `CONTRACT` 에 `POST /api/v1/question-responses/withdraw` 를 더했다

## 왜 이렇게 했나

- 74e273eb 에서 답 취소 API 를 만들고 docs/api.md 에는 적었지만 이 목록에 넣지 않았다. #278 의 Backend CI 와 AWS release 의 backend 가 `openapi_paths_match_api_md_contract` 하나로 실패했다(318개 중 1개). 새 QuestionAnswerIntegrationTest 4개는 CI 에서 통과했다
- 로컬은 Docker 가 없어 이 테스트를 돌리지 못했다. 이 브랜치로 띄운 로컬 백엔드의 /v3/api-docs 경로와 목록을 비교해 빠진 것도 남는 것도 없음을 확인했다

## 남은 것 · 아는 문제

- 통과 여부는 이번 push 의 CI 로 확인한다
