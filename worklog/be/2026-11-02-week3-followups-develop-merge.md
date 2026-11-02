# week3-followups 에 develop 을 합친다 (#214)

- 브랜치: feature/week3-followups
- 커밋: 87b5168 (머지 1개)
- 주요파일: ApiContractIntegrationTest.java, ApiResponseContractTest.java, HandoffNoteIntegrationTest.java, docs/api.md

## 한 일

- develop 의 규칙 후보 관리자 API(#174)와 이 PR 의 handoff-notes·export API 가 같은 자리에서 충돌했다. 셋 다 양쪽을 합쳤다.
  - `ApiContractIntegrationTest`: 엔드포인트 목록에 handoff-notes GET·POST 와 admin/rule-candidates 3개를 모두 둔다.
  - `ApiResponseContractTest`: import 를 합치고 중복(NextStep·ProgressService)을 하나로. 문진 사용자는 develop 의 `TestUser.ID`, 업종코드는 이 PR 의 `940909`.
  - `docs/api.md`: 트리에 handoff-notes·statutes·admin 을 모두 두고, 본문은 handoff-notes 를 3.14 비서 절 끝에, 그 뒤에 3.15 관리자 절을 둔다.
- develop 에서 `FixedUser` 가 지워졌으므로(#177) `HandoffNoteIntegrationTest` 를 같은 id 인 `TestUser.ID` 로 바꿨다.

## 왜 이렇게 했나

- handoff-notes 는 비서(agent-secretary.md FR-16)의 하위 기능이라 3.14 절에 붙였다. 3.15 관리자는 develop 이 이미 번호를 매긴 절이라 그대로 둔다.
- Flyway 는 develop 이 V17 까지, 이 PR 이 V18·V19 라 겹치지 않는다.

## 확인한 것

- develop + #172 + #186 + #214 를 합친 트리에서 `gradlew -p backend check` 통과(테스트 676개, 실패 0). 프런트 `npm test`·`build`·`lint` 통과(lint 경고만).
