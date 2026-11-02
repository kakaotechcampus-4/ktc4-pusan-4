# 이메일 회원가입과 이메일·비밀번호 로그인을 구현한다 (B9b)

- 브랜치: feature/email-account
- 커밋: 2db0398
- 주요파일: AuthService.java, EmailPasswordCredentialVerifier.java, UserService.java, V14__add_app_user_password_hash.sql, DefaultBearerTokenContextCustomizerFactory.java

## 한 일

- 계정 방식은 이메일과 카카오 둘 다 하기로 했다(2026-10-26 팀 결정). 이 PR 은 이메일 쪽이고, 카카오는 다음 PR 이다.
- `POST /auth/signup`: 이메일 형식·최대 320자, 비밀번호 8자 이상·UTF-8 72바이트 이하. 가입하고 바로 로그인한다(201, 응답은 로그인과 같다). 같은 이메일은 409 `EMAIL_ALREADY_EXISTS`.
- `app_user.password_hash`(V14)에 BCrypt 해시를 둔다. 가입은 `insert ... on conflict (email) do nothing` 한 문장이라 동시 가입도 하나만 남는다.
- `EmailPasswordCredentialVerifier` 가 `FixedUserCredentialVerifier` 를 대신한다. 없는 이메일에도 BCrypt 비교를 한 번 해서 응답 시간으로 가입 여부가 드러나지 않게 했다.
- `FixedUser`·`TemporaryUserSeeder`·`APP_AUTH_DEMO_PASSWORD` 를 지웠다. 테스트는 `TestUser`(같은 id·이메일)를 쓰고, `DefaultBearerTokenContextCustomizerFactory` 가 기동할 때 그 행을 만든다.
- api.md 1.1(회원가입·이메일 규칙), deployment.md 8절, backend README 를 고쳤다.

## 왜 이렇게 했나

- 메일 인증은 넣지 않았다. 메일 발송 인프라가 없고, 나중에 `email_verified_at` 컬럼과 로그인 검사 하나로 더할 수 있다.
- 이메일과 카카오 계정은 따로 둔다(같은 이메일이어도 합치지 않는다). 그래서 이 PR 은 카카오를 위한 컬럼을 만들지 않는다.
- 비밀번호 72바이트 상한: Spring Security 의 BCrypt 는 72바이트를 넘으면 예외를 던진다. 한글은 3바이트라 글자 수(@Size)만으로는 못 막아 서비스에서 바이트로 본다.

## 확인한 것

- 이 커밋 시점에는 이 환경에서 Gradle 을 돌리지 못했다. 로컬 `gradlew -p backend check` 결과는 아래에 이어 쓴다.

## 남은 것 · 아는 문제

- 운영의 예전 고정 사용자(demo@example.com) 행은 비밀번호가 없어 로그인할 수 없고 같은 이메일로 가입할 수도 없다. 시연 계정은 다른 이메일로 가입한다.
- 프론트에 가입 화면이 없다. 그 전까지 로컬은 스웨거로 가입한다.
- B9c(feature/refresh-token-redis) 위에 쌓았다. #155·#166·B9c 가 develop 에 들어간 뒤 PR 을 올린다.

## 16:44 로컬 check 결과

- `gradlew -p backend check` 통과(로컬, feature/email-account).
