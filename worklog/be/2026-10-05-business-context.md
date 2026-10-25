# 사업자 Context API 를 서비스로 바꾼다 (B1b)

- 브랜치: feature/business-context (feature/current-user 위)
- 커밋: 1개
- 주요파일: BusinessContextService.java, UserContextEntity.java, BusinessContextController.java, BusinessContextIntegrationTest.java

## 한 일

- `POST /users/me/contexts`, `GET /users/me/contexts`, `GET /users/me/contexts/current` 를 목에서 서비스로 교체
  - 생성: 사용자별 다음 버전으로 새 행. 기존 버전은 고치지 않는다
  - current: 가장 높은 버전, 없으면 `404 CONTEXT_NOT_FOUND`
  - 이력: version 오름차순 배열, 없으면 빈 배열
- `user_context` 엔티티·리포지토리, 도메인 `BusinessContext`·`NewBusinessContext`
- `BookkeepingDuty` 를 `user.api` 에서 `user.domain` 으로 옮겼다(엔티티가 api 패키지에 기대지 않도록)
- `UserMockData` 삭제 — users·contexts 목이 모두 서비스로 바뀌었다
- 테스트: 통합 테스트 4개(버전 증가·current·이력 / 문진 전 404 / 동시 생성 5건 버전 1~5 / 없는 사용자 401), 계약 테스트는 서비스 `@MockitoBean`

## 왜 이렇게 했나

- 버전은 `max(version)+1` 로 채번한다. 같은 사용자의 동시 요청이 같은 버전을 받으면 `UNIQUE(user_id, version)` 위반이 500 으로 나가므로, 채번 전에 `app_user` 행을 `PESSIMISTIC_WRITE` 로 잠근다.
- 사용자 행이 없으면 B1a 와 같이 401 이다.

## 남은 것 · 아는 문제

- A2b(run 생성)가 `contextId` 로 이 행을 읽어 엔진의 `UserContext` 로 바꾼다. 변환은 A2b 몫이다.
- 작업 환경에서 Gradle 을 돌릴 수 없어 컴파일·테스트는 로컬에서 확인해야 한다.
