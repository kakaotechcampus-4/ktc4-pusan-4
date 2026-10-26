# 규칙 후보 관리자 API 를 구현한다 (M1)

- 브랜치: feature/admin-rule-candidates
- 커밋: 0540a02
- 주요파일: AdminRuleCandidateController.java, RuleCandidateReviewService.java, AdminPolicy.java, UserController.java

## 한 일

- `GET /admin/rule-candidates`: `status` 필터(없으면 전체), createdAt DESC·id DESC, 페이지(1.4).
- `POST /admin/rule-candidates/{id}/approve`·`reject`: 대기·검토중·보류만 승인·기각으로 바꾸고 `reviewed_by`(관리자 이메일)·`reviewed_at` 을 남긴다. 이미 승인·기각한 후보는 409 `CONFLICT`, 없으면 404 `RULE_CANDIDATE_NOT_FOUND`.
- `AdminPolicy`: 관리자를 설정 `app.admin.emails`(`APP_ADMIN_EMAILS`, 쉼표 구분, 대소문자 무시)로 판별한다. 아니면 403 `FORBIDDEN`. 로컬 프로필은 고정 사용자(demo@example.com)를 관리자로 둔다.
- `GET /users/me` 에 `role`(USER·ADMIN)을 더했다.
- api.md 3.14 를 새로 쓰고 API Tree·1.3(403, 404 코드)·3.1 을 고쳤다. 운영 compose 와 production.env.example 에 `APP_ADMIN_EMAILS` 를 더했다.

## 왜 이렇게 했나

- 관리자 판별 방식은 팀에서 아직 정하지 않았다. 계정 방식(B9b)과 묶여 있어서 지금은 설정 목록으로 두고, 판별을 `AdminPolicy` 한 곳에 모았다. app_user 에 role 을 두게 되면 이 클래스 안만 바꾼다.
- 경로·응답 모양·에러는 프론트가 먼저 둔 가정(frontend/src/api/mock, `Admin.tsx`)을 따랐다. 상태는 DB 한글 값을 영어 code + 한글 label 로 내보낸다.
- `suggested_docs` 는 AI 파이프라인이 `[{statute_id, quote, tier}]` 로 쓰는데 기존 `RuleCandidateEntity` 는 `List<String>` 으로 매핑돼 있다. 엔티티는 건드리지 않고 JdbcClient 로 읽었다.
- 승인·기각은 `update ... where status in (...) returning *` 한 문장이라 두 관리자가 동시에 눌러도 한 번만 바뀐다.

## 확인한 것

- 이 커밋 시점에는 이 환경에서 Gradle 을 돌리지 못했다. 로컬 `gradlew -p backend check` 결과는 아래에 이어 쓴다.

## 남은 것 · 아는 문제

- 승인 뒤 규칙 카드 PR 자동 생성은 발표 범위 밖이다.
- #155(Bearer 인증)·B9c 와 `UserController`·`ApiResponseContractTest` 가 겹친다. 나중에 머지되는 쪽에서 양쪽을 살린다.
