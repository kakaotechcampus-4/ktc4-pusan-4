# 요청 사용자 리졸버와 GET /users/me 실제 구현 (B1a)

- 브랜치: feature/current-user
- 커밋: 1개
- 주요파일: CurrentUserArgumentResolver.java, TemporaryCurrentUserProvider.java, UserService.java, UserController.java

## 한 일

- `shared/auth`: `CurrentUser`(record) 인자를 컨트롤러에 채우는 리졸버와 `CurrentUserProvider` 인터페이스
  - 임시 구현 `TemporaryCurrentUserProvider`: 요청과 상관없이 고정 사용자(`MockFixtures.USER_ID` 와 같은 id)
  - `TemporaryUserSeeder`: 기동 시 그 사용자 행을 `on conflict do nothing` 으로 넣는다
  - `CurrentUser` 는 스웨거 파라미터에서 뺐다
- `user`: `AppUserEntity`(app_user 매핑), `AppUserRepository`, `UserService.get`, 도메인 `AppUser`
- `GET /users/me` 를 목에서 서비스로 교체하고 `@MockResponse`, `UserMockData.me()` 를 지웠다
- 테스트: `UserServiceTest`(있음/없음 401), 계약 테스트에 `/users/me` 필드 집합과 현재 사용자 id 전달 확인,
  통합 테스트에 시드된 사용자 응답과 스웨거 파라미터 미노출 확인
- backend/README.md 에 `CurrentUser` 패턴을 적었다

## 왜 이렇게 했나

- 인증 도입 때 구현체 하나만 바꾸도록 인터페이스를 뒀다(backend_api_plan 공통 규칙 "사용자 식별").
- 임시 사용자를 Flyway 로 넣지 않았다. 지울 때도 마이그레이션이 필요하고 운영 DB 에 가짜 사용자가 남는다.
- 사용자가 없으면 404 가 아니라 401 이다. 인증을 통과했는데 행이 없으면 다시 로그인해야 하는 상태다.
- 임시 id 를 목 고정 id 와 맞춰, 아직 목인 contexts 응답의 userId 와 어긋나지 않게 했다.

## 남은 것 · 아는 문제

- `DELETE /users/me` 는 목 그대로다(B6).
- 작업 환경에서 Gradle 을 돌릴 수 없어 컴파일·테스트는 로컬에서 확인해야 한다.
