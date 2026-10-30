# 규칙 후보 관리자 API 리뷰 반영 — role 컬럼, 엔티티 매핑, Repository 분리 (M1, #174)

- 브랜치: feature/admin-rule-candidates (#186 refactor/service-queries-to-repositories 위)
- 주요파일: AdminPolicy.java, V17__add_app_user_role.sql, RuleCandidateEntity.java, RuleCandidateRepository.java, RuleCandidateReviewRepository.java, RuleCandidateReviewService.java

## 한 일

- develop 을 합쳤다. api.md 는 develop 의 비서(3.14)와 이 PR 의 관리자 절이 같은 번호를 써서 관리자를 3.15 로 옮겼다.
- #186 을 합쳐 그 위에 쌓았다(유렬 제안대로 조회는 #186 의 RuleCandidateRepository 를 쓴다). #186 과 develop 이 `ClassificationReviewEntity` 에서 겹쳐 양쪽 메서드를 모두 살렸다.
- 관리자 판별을 설정의 이메일 목록(`APP_ADMIN_EMAILS`)에서 `app_user.role`(V17, 기본 USER)로 바꿨다. `AdminPolicy.requireAdmin` 만 남기고, `GET /users/me` 의 role 은 사용자 행에서 읽는다. 관리자 지정 절차를 deployment.md 11절, 로컬 방법을 backend README 에 적었다.
- `RuleCandidateEntity.suggested_docs` 를 `List<String>` 에서 AI 파이프라인이 쓰는 `{statute_id, quote, tier}` 모양(`SuggestedDocJson`)으로 고치고, status·reviewed_by·reviewed_at·created_at 을 매핑해 `toDomain()` 으로 읽는다. `SaveRuleCandidateCommand` 도 같은 타입이다.
- 규칙 후보 도메인(`RuleCandidate`, `RuleCandidateStatus`)과 서비스를 `judgment` 로 옮겼다. 엔티티·Repository 가 거기 package-private 이라서다. `admin` 에는 API 만 남는다.
- 조회는 `RuleCandidateRepository`(Spring Data, 정렬은 Pageable), 승인·기각은 `RuleCandidateReviewRepository`(JdbcClient, `update ... where status in (...)`)가 맡고, `RuleCandidateReviewService` 는 409·404 판단만 한다. 바꾼 뒤에는 엔티티로 다시 읽어 JSON 을 직접 파싱하지 않는다.
- 이메일이 없는 관리자(카카오)는 reviewed_by 에 사용자 id 를 남긴다.

## 왜 이렇게 했나

- 마이그레이션은 V17 이다. 인증 스택(#177 V15, #176 V16)이 먼저 머지된다는 전제다(성진 결정). #174 가 먼저 들어가면 운영 DB 에 V17 이 V15·V16 보다 먼저 적용돼 Flyway 검증이 깨진다.
- 승인·기각을 엔티티 수정으로 하지 않았다. 두 관리자가 동시에 누르면 둘 다 "대기" 를 읽고 둘 다 바꾼다. UPDATE 한 문장의 조건이 그 경합을 막는다.

## 확인한 것

- 이 환경에서는 Gradle 을 돌리지 못했다(Maven 저장소 차단). 바꾼 Java 파일의 문법만 javac 로 봤다. 로컬 `gradlew -p backend check` 결과는 아래에 이어 쓴다.

## 남은 것 · 아는 문제

- 머지 순서: 인증 스택(#178 → #177 → #176 → #193) → #186 → 이 PR. PR base 를 refactor/service-queries-to-repositories 로 바꾼다.
- 인증 스택과 `AppUser`·`AppUserEntity`·`ApiResponseContractTest` 가 겹친다. 나중에 머지하는 쪽에서 양쪽(비밀번호·카카오 id 와 role)을 살린다.
