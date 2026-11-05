# 배포 번들을 실서버로 돌린다 (web.Dockerfile 한 줄)

- 브랜치: chore/deploy-vite-api-http (develop eebd836 위)
- 커밋: 1개
- 주요파일: deploy/web.Dockerfile

## 한 일

`RUN npm run build` 를 `RUN VITE_API=http npm run build` 로 바꿨다.

## 왜 이렇게 했나

`src/api/index.ts:13` 이 `import.meta.env.VITE_API === 'http'` 일 때만 `httpApi` 를
고른다. 빌드에 그 값이 없어서 **지금 배포된 화면은 목업으로 돈다 — `/api/v1` 을
한 번도 부르지 않는다.** 10/21·11/01 worklog 에 두 번 적혀 있던 것이고, 고치는 것은
이 한 줄뿐이다.

운영 번들(`index-Dhwb5uUg.js`, 10/28 배포)을 내려받아 확인했다.

| 번들 | `/api/v1` 문자열 | 「목업 비밀번호는 …」 배너 |
| :--- | ---: | :--- |
| 운영 (지금) | 0 | 있음 |
| 로컬 `npm run build` | 0 | 있음 |
| 로컬 `VITE_API=http npm run build` | 1 | 없음 |

운영 번들이 `VITE_API` 없는 로컬 빌드와 같은 꼴이다. `http.ts` 가 통째로
트리셰이킹돼 빠져 있다.

## 따로 떼어 둔 이유 — 머지 전에 확인할 것

이 줄이 release 에 들어가는 순간 배포 화면의 「샘플 계정으로 둘러보기」가
`isMock` 으로 사라지고 실서버 로그인만 남는다. 그런데 develop 의 인증이 release 와
다르다.

- `FixedUser`·`TemporaryUserSeeder` 가 develop 에서 **삭제**됐다. `demo@example.com` 과
  `APP_AUTH_DEMO_PASSWORD` 가 없다.
- 기존 `demo@example.com` 행은 남지만 `V15` 가 더한 `password_hash` 가 NULL 이고,
  `AppUserEntity.java:44` 의 `Optional.ofNullable(passwordHash)` 가 빈 Optional 을
  내서 `EmailPasswordCredentialVerifier` 가 401 을 낸다.
- 남은 입구는 회원가입인데 메일 인증 코드가 필요하다.
  `EmailVerificationService.java:38` 이 `mailSender.available()` 이 false 면 **503** 이다.
  `compose.yaml:54-55` 의 `APP_MAIL_USERNAME`·`APP_MAIL_PASSWORD` 는 기본값이 빈 문자열이다.

**서버의 운영 환경변수 파일에 메일 계정(또는 카카오 키)이 들어 있는지 확인된 뒤에
머지한다.** 비어 있으면 아무도 로그인할 수 없다.

## 확인

- `VITE_API=http npm run build` 통과(1.82s). 위 표의 번들 측정은 이 빌드와
  `VITE_API` 없는 빌드를 같은 PC 에서 각각 만들어 센 것이다.
- 이미지를 실제로 빌드하거나 배포하지는 않았다. docker 를 띄우지 않았다.

## 남은 것 · 아는 문제

- develop → release 머지와 재배포는 이 PR 범위가 아니다.
- 메일 계정 확인은 BE 쪽에 물어야 한다. 이 PC 에서 서버 설정 파일을 읽을 수 없다.
