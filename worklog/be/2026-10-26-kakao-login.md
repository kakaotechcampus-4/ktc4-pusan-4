# 카카오 로그인을 구현한다 (B9b)

- 브랜치: feature/kakao-login
- 커밋: d92bdd9
- 주요파일: KakaoClient.java, AuthService.java, UserService.java, V15__add_app_user_kakao_id.sql

## 한 일

- `POST /auth/kakao {code}`: 프론트 콜백 페이지가 받은 인가 코드를 `kauth.kakao.com/oauth/token` 에서 카카오 토큰으로 바꾸고, `kapi.kakao.com/v2/user/me` 로 카카오 회원번호를 읽는다. 그 번호로 계정을 찾거나 만들고, 응답은 로그인과 같다(200 + 리프레시 쿠키).
- `app_user.kakao_id`(V15, UNIQUE). 카카오 계정은 이메일이 없어 `email` 을 nullable 로 바꾸고 `email`·`kakao_id` 중 하나는 있게 CHECK 를 걸었다. 계정 생성은 `insert ... on conflict (kakao_id) do nothing` 뒤에 다시 읽는다.
- 에러: 코드가 틀렸거나 이미 썼으면 401 `INVALID_KAKAO_CODE`, 카카오 5xx·시간 초과는 502 `KAKAO_UNAVAILABLE`, 키나 콜백 주소가 설정되지 않았으면 503 `KAKAO_LOGIN_UNAVAILABLE`.
- 설정 `app.auth.kakao.*`(`APP_AUTH_KAKAO_REST_API_KEY`·`_CLIENT_SECRET`·`_REDIRECT_URI`). 로컬 콜백 기본값은 `http://localhost:5173/auth/kakao/callback`. 운영 compose·production.env.example·deployment.md 8절·api.md 1.1 을 고쳤다.

## 왜 이렇게 했나

- 2026-10-26 결정: 인가 코드는 프론트가 받아 POST 한다(응답이 이메일 로그인과 같아진다). 이메일 계정과 카카오 계정은 같은 이메일이어도 합치지 않는다. 카카오 이메일 동의항목은 사업자 정보가 있는 비즈 앱만 신청할 수 있어 이메일을 받지 않는다.
- redirect_uri 는 요청 본문이 아니라 환경별 설정으로 받는다. 카카오는 인가 요청과 토큰 요청의 redirect_uri 가 같아야 받아 준다.
- 카카오 호출 시간 제한은 연결 3초·읽기 5초. 로그인 요청이 그동안 붙잡혀 있다.

## 확인한 것

- 이 커밋 시점에는 이 환경에서 Gradle 을 돌리지 못했다. 카카오 앱이 아직 없어 실제 카카오로는 확인하지 않았다(KakaoClientTest 는 MockRestServiceServer).

## 남은 것 · 아는 문제

- 카카오 앱 등록(REST API 키, 콜백 주소, Client Secret)과 프론트 콜백 경로 합의가 남았다.
- 탈퇴할 때 카카오 연결 끊기(unlink)는 하지 않는다. 카카오 쪽 연결은 남지만 우리 계정은 지워지고, 다시 로그인하면 새 계정이다.
- M1 `AdminPolicy` 가 이메일이 null 인 사용자를 처리해야 한다(feature/admin-rule-candidates 에 따로 고친다).
- feature/email-account(B9b 이메일) 위에 쌓았다. PR 은 이메일 쪽과 따로 올린다.
