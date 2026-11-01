# admin-rule-candidates(#174) 에 develop 을 merge 해 충돌을 푼다

- 브랜치: feature/admin-rule-candidates
- 커밋: merge 1개
- 주요파일: application.yml, application-local.yml, ApiResponseContractTest.java, api.md

## 한 일

- #154(Bearer 인증)·#166(Redis) 이 develop 에 들어가 #174 가 CONFLICTING 이 됐다. develop(a12c258)을 merge 했다.
- `application.yml`: develop 의 `app.auth` 와 이 브랜치의 `app.admin` 을 둘 다 남겼다.
- `ApiResponseContractTest`: develop 의 `TestAuthentication` import 와 이 브랜치의 관리자 목 import 를 둘 다 남겼다.
- `api.md` 공통 오류 표: develop 의 401 설명(토큰이 틀리거나 만료됨)에 이 브랜치의 403 FORBIDDEN 줄을 더했다.
- `application-local.yml`: 텍스트 충돌은 없었지만 양쪽이 각자 최상위 `app:` 블록을 더해 키가 두 번 생겼다. Spring Boot 는 YAML 중복 키를 거부해 local 프로필 기동이 실패하므로 하나의 `app:` 아래로 합쳤다.

## 왜 이렇게 했나

- 이미 push 된 브랜치라 rebase + force push 대신 merge 했다.
- 테스트는 local 프로필을 쓰지 않아 중복 키가 CI 에서 드러나지 않는다.

## 확인한 것

- 충돌 표시가 남지 않았고, 세 YAML 파일을 중복 키 검사로 다시 읽었다.
- `AdminRuleCandidateIntegrationTest` 는 #154 의 기본 테스트 토큰(FixedUser, demo@example.com)으로 요청하고 `app.admin.emails=Demo@Example.com` 이라 그대로 관리자다.
- 이 환경에서는 Gradle 의존성을 받지 못해 `gradlew -p backend check` 를 돌리지 못했다. 로컬 결과는 아래에 이어 쓴다.
