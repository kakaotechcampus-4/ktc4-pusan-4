# 이메일 가입에 메일 인증을 붙인다 (B9b-1 후속)

- 브랜치: feature/email-verification (feature/kakao-login 위)
- 주요파일: EmailVerificationService.java, EmailVerificationStore.java, SmtpVerificationMailSender.java, AuthService.java, AuthIntegrationTest.java

## 한 일

- 가입 전에 메일 인증을 한다: `POST /auth/email-verification`(6자리 코드 메일) → `POST /auth/email-verification/confirm`(코드 확인, `verificationToken` 응답) → `POST /auth/signup` 에 그 토큰을 싣는다. 토큰이 없거나 다른 이메일 것이면 400 `EMAIL_NOT_VERIFIED`.
- 인증 상태는 Redis(`email-verify:*`)에 둔다. 코드 5분, 재발송 60초에 한 번, 이메일 하나에 하루 10번, 코드 하나에 5번 틀리면 폐기, 인증 토큰 30분. 확인·발급은 Lua 스크립트 하나로 한다.
- 메일은 Gmail SMTP(`APP_MAIL_USERNAME`·`APP_MAIL_PASSWORD`, 앱 비밀번호)로 보낸다. 로컬 프로필은 `APP_AUTH_EMAIL_DELIVERY=log` 라 백엔드 로그에 코드를 찍는다. 계정이 비면 503 `EMAIL_VERIFICATION_UNAVAILABLE`.
- 메일 health 는 뺐다(Redis 와 같은 이유).
- 이메일 정규화를 `user.domain.Emails` 로 꺼내 가입·로그인·인증이 같이 쓴다.
- api.md 1.1, deployment.md 9절, production.env.example, compose.yaml, backend README 를 고쳤다.

## 왜 이렇게 했나

- 가입 전 인증(성진 선택): 인증하지 않은 계정이 DB 에 생기지 않아 `email_verified_at` 컬럼·로그인 차단이 필요 없다. 기존 계정은 그대로 로그인한다.
- 코드는 6자리라 해시해도 금방 풀려 원문으로 두고, 틀린 횟수와 하루 발송 횟수로 맞혀 보기를 막는다. 인증 토큰은 해시만 둔다.
- 메일을 못 보내면 코드와 재발송 대기를 지워 바로 다시 요청할 수 있게 했다.
- 인증 요청에서 이미 가입한 이메일은 409 다. 가입 API 가 이미 409 로 가입 여부를 알려 주고 있어 새로 드러나는 것은 없다.

## 확인한 것

- 이 환경에서는 Maven 저장소가 막혀 Gradle 을 돌리지 못했다. Lua 스크립트 두 개는 redis-server 7 에 직접 EVAL 해 쿨다운·5회 폐기·하루 한도·TTL 을 확인했다.
- 로컬 `gradlew -p backend check` 결과는 아래에 이어 쓴다.

## 남은 것 · 아는 문제

- IP 단위 요청 제한은 없다. Gmail 한도(하루 약 500통)를 여러 이메일로 쓸 수는 있다.
- 프론트 가입 화면이 이 흐름(코드 받기 → 확인 → 비밀번호)을 따라야 한다. 프론트 팀에 api.md 1.1 을 공유한다.
- 운영에 `APP_MAIL_*` 를 넣기 전에 배포하면 새 이메일 가입이 503 이다.
