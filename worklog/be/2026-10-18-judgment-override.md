# 판정 수정(override)과 해제를 목에서 실제 저장으로 바꾼다 (A5)

- 브랜치: feature/judgment-override (base: feature/question-responses)
- 커밋: 199dfee..199dfee (1개)
- 주요파일: JudgmentOverrideService.java, JudgmentEntity.java, JudgmentOverrideRepository.java, JudgmentOverrideIntegrationTest.java

## 한 일

- `POST /judgments/{id}/override`: 수정한 판정에서 verdict 만 바꾼 새 revision 을 만든다. origin 은 `judgment_override_id`. 계정과목·룰카드·속성·입력 사실·인용은 이어받고, `outOfScope` 는 끈다. 질문과 unmatched_log 는 만들지 않는다.
- 같은 거래의 이전 활성 override 는 새 override 를 넣기 전에 `releaseActive`(@Modifying update)로 해제한다.
- `DELETE /judgment-overrides/{id}`: `active=false`, `released_at` 을 남긴다. 이미 해제된 것도 204, 없거나 남의 것이면 404 `JUDGMENT_OVERRIDE_NOT_FOUND`.
- 에러: 400 `VALIDATION_ERROR`(toVerdict 없음·enum 밖), 404 `JUDGMENT_NOT_FOUND`, 409 `CONFLICT`(현재 판정이 아님·판정 대상 아님), 422 `UNPROCESSABLE_ENTITY`(NEEDS_REVIEW). api.md 3.8 에 적었다.
- 두 API 의 `@MockResponse`, `JudgmentMockData.override()`, `MockFixtures.OVERRIDE_ID`·`OVERRIDE_JUDGMENT_ID` 를 지웠다. 계약 테스트는 `@MockitoBean JudgmentOverrideService` 로 본다.

## 왜 이렇게 했나

- 에러 정의는 #62 에서 논의 중이다. 사용자 결정으로 FE 목업(`api/mock/index.ts` override)이 이미 따르는 쪽을 택했다: NEEDS_REVIEW 막음, 현재 판정 아님 409, 판정 대상 아님 409, 같은 verdict 허용, Idempotency-Key 없음.
- 이전 override 를 엔티티로 끄지 않은 이유: Hibernate 는 flush 때 insert 를 update 보다 먼저 보내서, 새 행이 먼저 들어가 거래당 활성 하나(`uq_judgment_override_active_transaction`)에 걸린다.
- `outOfScope` 를 끈 이유: `judgment_out_of_scope_needs_review` 제약이 대상 밖 표시를 확인 필요에만 허용한다. 수정은 확인 필요로 가지 않는다.
- 현재 판정은 판정 목록의 "현재 판정" 쿼리(`findPage`)를 그대로 써서 고른다. 조건을 두 곳에 두지 않으려고.
- 거래 락(`findByIdForUpdate`)을 먼저 잡는다. 재판정이 새 revision 을 쓰는 것과 같은 락이라, 확인한 현재 판정이 저장 전에 바뀌지 않는다.
- 응답은 저장 트랜잭션이 끝난 뒤 `JudgmentQueryService.get` 으로 다시 읽는다. `computed_at` 은 DB 기본값이라 같은 영속성 컨텍스트에서는 비어 있다.
- 새 테스트는 `MockFixtures.USER_ID` 를 쓴다. 인증 PR(#154)이 `TemporaryCurrentUserProvider` 상수를 지우므로 그때 고칠 곳을 늘리지 않으려고.

## 확인한 것

- `JudgmentOverrideIntegrationTest` 11개: 새 revision 내용·원본 보존·수정 기록, 대상 밖 확인 필요 수정, 두 번째 수정이 첫 수정을 해제, 이후 자동 판정이 와도 수정이 현재 판정, 해제 후 자동 판정으로 돌아감·반복 해제 204, 404 두 종류, 409 두 종류(지난 revision, 제외·취소상계), 422, 400.
- `releaseActive` 호출을 지우면 `second_override_releases_the_first` 가 실패하는 것을 확인했다.
- `gradlew -p backend check` 통과(test 295, integrationTest 100).

## 남은 것 · 아는 문제

- 화면(결과 상세 패널의 수정·해제)으로는 확인하지 않았다.
- #62 는 아직 열려 있다. 이 PR 의 결정이 맞으면 이슈에 반영해 닫아야 한다.
- 수정 revision 의 금액은 A6 전이라 비어 있다.
