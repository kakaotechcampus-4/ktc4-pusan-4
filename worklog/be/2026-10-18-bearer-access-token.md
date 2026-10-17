# 임시 사용자 대신 Bearer 액세스 토큰으로 요청 사용자를 확인한다

- 브랜치: feature/bearer-access-token
- 커밋: 5fc409f..5fc409f (1개)
- 주요파일: BearerCurrentUserProvider.java, AccessTokens.java, CurrentUserWebConfig.java, DefaultBearerTokenContextCustomizerFactory.java

## 한 일

- `TemporaryCurrentUserProvider`(요청과 상관없이 고정 사용자)를 지우고 `auth.BearerCurrentUserProvider` 로 바꿨다.
  `Authorization: Bearer {accessToken}` 이 없거나 틀리거나 만료면 401 `UNAUTHORIZED` 다.
- `CurrentUserWebConfig` 에 인터셉터를 붙여 `/api/v1/auth/**` 를 뺀 모든 API 가 토큰을 확인한다.
  `CurrentUser` 인자가 없는 목 응답 API 도 막는다.
- `AccessTokens`(발급·검증, 15분)와 `SignedTokens`(HS256, nimbus-jose-jwt 10.10).
  만료는 nimbus 의 시스템 시각 대신 주입한 `Clock` 으로 본다.
- 서명 키는 `APP_AUTH_JWT_SECRET`. 비면 기동마다 임시 키를 만들고, 32바이트보다 짧으면 기동을 멈춘다.
- 고정 사용자 id·이메일은 `FixedUser` 로 옮겼다. `TemporaryUserSeeder` 는 그대로 둔다.
- 테스트: 자동 구성 MockMvc 요청에 고정 사용자 토큰을 기본으로 싣는 `DefaultBearerTokenContextCustomizerFactory`
  (`src/test/resources/META-INF/spring.factories`). `@WebMvcTest` 는 `@Import(TestAuthentication.class)` 를 붙인다.

## 왜 이렇게 했나

중간 발표(10/22) 라이브 데모에서 FE #142 의 로그인(#139 가정: 액세스 토큰은 헤더, 리프레시 토큰은 httpOnly 쿠키)을
실서버로 보여 주려고 B9b 의 일부를 당겼다. 세션 방식은 #142 와 맞지 않아 B9b 때 버리게 돼 쓰지 않았다.

인증은 인자 리졸버가 아니라 인터셉터에서 확인한다. 리졸버만 두면 `CurrentUser` 인자가 없는 API 가 열린다.

테스트 기본 토큰을 spring.factories 로 붙인 이유: 열린 PR(#127~#135, #124~#148)이 새 통합 테스트를 계속 추가하고 있어,
테스트마다 헤더를 넣게 하면 머지할 때마다 그 PR 들을 고쳐야 한다. 기본 토큰은 요청마다 새로 발급해
컨텍스트 캐시가 오래 살아도 만료에 걸리지 않는다.

로그인·재발급·로그아웃 API 는 1000줄 제한 때문에 다음 PR(feature/fixed-jwt-auth)로 나눴다.
이 PR 만 배포하면 로그인할 방법이 없어 모든 API 가 401 이다. 둘을 함께 머지한다.

## 확인한 것

- `gradlew -p backend check` 통과: test 295, integrationTest 64.
- `AuthIntegrationTest`: 토큰 없음·틀린 토큰 401, 목 응답 API(`/transactions`)도 401, 발급한 토큰으로 `/users/me` 200, health 공개.

## 남은 것 · 아는 문제

- 열린 PR 들이 `TemporaryCurrentUserProvider.TEMPORARY_USER_ID`·`TEMPORARY_USER_EMAIL` 을 테스트에서 쓴다.
  이 PR 뒤에 머지하면 컴파일이 깨지므로 `FixedUser.ID`·`FixedUser.EMAIL` 로 바꾸고,
  `ApiResponseContractTest` 의 `@Import` 는 `TestAuthentication.class` 로 바꾼다.
- 로컬에서 bootRun 으로 직접 띄워 보지는 않았다. 통합 테스트로만 확인했다.

## 01:10 고정 사용자 로그인·토큰 재발급·로그아웃 API (feature/fixed-jwt-auth, 057b9e3)

앞 PR(feature/bearer-access-token) 위에 쌓았다. 1000줄 제한 때문에 나눴고 둘은 함께 머지한다.

- `POST /api/v1/auth/login`·`/refresh`·`/logout`. 계약은 api.md 1.1 에 새로 적었다(FE #142 의 #139 가정과 같다).
  액세스 토큰은 본문, 리프레시 토큰은 `refresh_token` 쿠키(HttpOnly, SameSite=Strict, Path=/api/v1/auth, Domain 없음, 14일).
- 나중에 바꿀 곳은 인터페이스 두 개로만 뒀다.
  - `RefreshTokenStore`(issue·rotate·revoke·revokeAll): 지금은 `StatelessRefreshTokenStore` — 서명만 보고 저장하지 않아
    `revoke`·`revokeAll` 은 아무것도 하지 않는다. B9c 에서 Redis 구현으로 빈만 바꾼다.
  - `CredentialVerifier`: 지금은 `FixedUserCredentialVerifier` — `demo@example.com` 과 `APP_AUTH_DEMO_PASSWORD` 만 통과.
    비밀번호 설정이 비면 아무도 로그인하지 못한다. B9b 에서 실제 계정·카카오 구현으로 바꾼다.
  - `AuthService`·`AuthController` 는 두 인터페이스만 봐서 교체해도 바뀌지 않는다.
- 쿠키 모양은 `RefreshCookie` 한 곳에만 둔다. `Secure` 는 `app.auth.cookie-secure`(로컬 프로필만 false).
- 로컬 프로필 비밀번호는 `demo1234`. 운영은 `/etc/ktc4/production.env` 의 `APP_AUTH_JWT_SECRET`·`APP_AUTH_DEMO_PASSWORD`
  (deploy/compose.yaml 이 백엔드에 넘긴다, docs/deployment.md 8절).
- docs/backend_api_plan.md 의 B9b·B9c 에 끝난 것과 남은 것을, 결정 표의 인증 행에 10/18 결정을 적었다.

확인: `gradlew -p backend test`·`integrationTest` 통과(test 306, integrationTest 69).
`AuthIntegrationTest` 가 로그인 성공·쿠키 속성, 비밀번호 오류 401 `INVALID_CREDENTIALS`, 재발급, 쿠키 없는 재발급 401
`INVALID_REFRESH_TOKEN`, 로그아웃 시 `Max-Age=0`, 리프레시 토큰을 Bearer 로 쓰면 401 을 본다.

남은 것: 운영 서버의 환경 파일에 두 값을 넣는 일은 하지 않았다. 브라우저(FE #142)로 실제 로그인·새로고침 복원은 아직 해 보지 않았다.
