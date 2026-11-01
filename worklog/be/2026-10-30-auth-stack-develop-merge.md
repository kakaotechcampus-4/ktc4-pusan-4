# 인증 스택에 develop 을 합친다 (#178 → #177 → #176 → #193)

- 브랜치: feature/refresh-token-redis, feature/email-account, feature/kakao-login, feature/email-verification

## 한 일

- #178(refresh-token-redis)이 develop 과 `application.yml` 에서 충돌했다. develop 이 더한 `judgment-run.await-termination`·`assistant` 설정을 살리고, 인증 주석은 이 PR 문구로 뒀다.
- 위 스택을 차례로 합쳤다. `application.yml`·`application-local.yml` 충돌은 develop(#183·#185)의 구조에 각 PR 설정(kakao·email-verification)을 얹는 쪽으로 풀었다.
- develop 의 새 테스트(QuestionSuggestion·AssistantRelay·Progress IntegrationTest)가 `FixedUser.ID` 를 쓴다. email-account 에서 `FixedUser` 를 지웠으므로 같은 id 인 `TestUser.ID` 로 바꿨다(email-account 머지 커밋).
- Flyway 버전이 develop 의 `V14__add_user_fact_source` 와 겹쳐 `V14__add_app_user_password_hash` → V15, `V15__add_app_user_kakao_id` → V16 으로 밀었다.

## 왜 이렇게 했나

- 인증 스택이 develop 에 들어가려면 맨 아래 #178 의 충돌부터 풀어야 하고, 위 PR 들도 같은 develop 을 받아야 diff 가 자기 커밋만 보인다.
- 마이그레이션 번호: 둘 다 develop 에 들어가지 않은 번호라 이 스택 쪽을 민다. develop 의 V14 는 이미 다른 PR 들이 전제로 쓴다.

## 확인한 것

- 이 환경에서는 Gradle 을 돌리지 못했다(Maven 저장소 차단). 두 설정 파일은 중복 키 없이 읽히는 것만 확인했다. 로컬 `gradlew -p backend check` 결과는 아래에 이어 쓴다.

## 남은 것 · 아는 문제

- 로컬 DB 에 예전 V14(password_hash)·V15(kakao_id)가 이미 적용돼 있으면 Flyway 검증이 실패한다. 로컬 DB 볼륨을 지우거나 `flyway_schema_history` 의 두 행을 지우고 다시 띄운다.
