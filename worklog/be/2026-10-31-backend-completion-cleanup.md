# 백엔드 완료 기준에 맞춰 문서를 정리한다

- 브랜치: docs/backend-completion-cleanup
- 주요파일: docs/architecture.md, docs/backend_api_plan.md, docs/deployment.md, backend/README.md

## 한 일

- `docs/architecture.md` "구현 범위"를 10월 계획의 기본 흐름 기준으로 다시 썼다. 예전 내용은 판정 엔진·영속성·REST 계층을 "미착수"로 적고 있었다.
- 계획 문서의 "저장소 결정"을 `docs/architecture.md` 로 옮겼다(계획 "문서 정리" 항목). 이후에 생긴 Redis 사용처(메일 인증, 비서 한도)와 여러 탭 재발급을 프론트 `navigator.locks` 로 묶기로 한 결정(#178)도 같이 적었다.
- `docs/deployment.md` 머리말의 "주요 API 는 501" 과 `backend/README.md` 의 "단위 테스트가 없어 NO-SOURCE" 를 지금 상태로 고쳤다.

## 왜 이렇게 했나

- 계획 문서의 완료 기준·문서 정리 항목이 이 네 곳을 가리킨다. 기능 PR 들은 각자 자기 절만 고쳐서 머리말·구현 범위가 남아 있었다.

## 11/2 추가

- develop 을 합쳤다. 인증 스택(#176·#177·#178·#193)과 #184 가 들어가 컨트롤러에 남은 `@MockResponse` 가 없다.
- 완료 기준 1에 따라 `MockResponse`·`MockFixtures` 와 스웨거의 `[목 응답]` 표시(`OpenApiConfig.mockResponseNote`)를 지웠다. `MockFixtures.USER_ID` 를 쓰던 `JudgmentOverrideIntegrationTest` 는 같은 값인 `TestUser.ID` 로 바꿨다.
- `AuthIntegrationTest` 의 "CurrentUser 인자가 없는 API 도 401" 검사는 거래 목록이 서비스로 바뀌어 인자가 생겼으므로, 지금도 인자가 없는 법령 조회(`/statutes/{id}`)로 바꿨다.
- 계획 문서 B9b·B9c 의 "머지 대기" 를 머지된 PR 번호로 바꿨고, README "목 응답" 절은 지웠다.

## 남은 것 · 아는 문제

- 구현 범위의 "미분류 가맹점 분류 모델 호출" 은 #209(분류 모델 백엔드 연동) 상태를 적었다. #209 뒤에 머지한다.
- 세션 환경에서 Gradle 배포판을 받을 수 없어 `check` 를 돌리지 못했다. CI 결과로 확인한다.
