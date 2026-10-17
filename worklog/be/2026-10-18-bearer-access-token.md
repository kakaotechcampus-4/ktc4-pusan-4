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
