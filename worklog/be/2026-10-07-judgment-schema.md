# PR #98 리뷰 반영: 문진 참조 FK, override 쌍 FK, user_fact NOT NULL 방침 (A1a)

- 브랜치: feature/judgment-schema
- 커밋: be5019f..bf49936 (3개)
- 주요파일: V7__judgment_runs_and_delete_policy.sql, JudgmentSchemaIntegrationTest.java, docs/api.md, docs/architecture.md

## 한 일

- PR #98 리뷰(memoryhong) 지적 3개를 반영했다.
- `judgment_run.context_id` 를 `ON DELETE CASCADE` 에서 `DEFERRABLE INITIALLY DEFERRED`(커밋 때 검사)로 바꿨다.
  - V7 주석과 docs/architecture.md 의 참조 FK 목록에 넣었다.
  - 테스트 `context_version_used_by_a_run_is_not_deleted`: 판정이 아직 없는 run 이 쓰는 문진 버전은 지워지지 않는다.
- `judgment_override.source_judgment_id` 를 단독 FK 에서 `(source_judgment_id, transaction_id)` → `judgment(id, transaction_id)` 쌍 FK 로 바꿨다.
  - 이를 위해 `judgment` 에 `UNIQUE (id, transaction_id)` 를 걸었다.
  - `transaction_id` 칸은 유지한다. docs/api.md 의 override 컬럼 목록 두 곳(§3.8, §7)에 넣고 이유를 적었다.
  - 테스트 `override_source_must_be_a_judgment_of_the_same_transaction`: 다른 거래의 판정을 원래 판정으로 가리키면 거부된다.
- `user_fact.batch_id` NOT NULL 방침을 V7 (6) 주석에 적었다. 코드 변경은 없다.

## 왜 이렇게 했나

- context_id
  - run 은 batch 에 속하고 문진은 가리키기만 한다. 참조 FK 다. 앞 커밋에서 정한 "소유만 CASCADE" 원칙에서 빠져 있었다.
  - 원래 CASCADE 로 바꾼 이유(탈퇴 때 user_context 가 run 보다 먼저 지워져 막힘)는 user_fact 와 같은 순서 문제라, 커밋 때 검사로 풀린다. 탈퇴 테스트가 그대로 통과한다.
  - 판정이 있는 run 은 CASCADE 여도 `judgment.run_id` 검사에 걸려 결과가 같다. 그래서 테스트는 판정이 없는 run 으로 했다. 이 경우 CASCADE 면 run 과 실패 기록이 조용히 사라졌다.
- override 쌍 FK
  - 두 칸이 따로 FK 라 거래 A 의 override 가 거래 B 의 판정을 가리켜도 들어갔다. 그러면 B 의 batch 를 지울 때 엉뚱하게 막혀서 늦게 드러난다.
  - 정상 구현은 판정에서 거래를 꺼내 쓰므로 애플리케이션에서는 어긋날 일이 거의 없다. DB 제약은 다른 코드 경로·손으로 넣은 SQL 까지 막는 안전망이다. V7 이 아직 머지 전이라 지금 넣는 비용이 가장 작다.
  - `transaction_id` 를 빼는 안도 검토했다. 빼면 "거래당 활성 하나" 부분 UNIQUE 를 걸 칸이 없어 트리거나 애플리케이션 잠금이 필요하다. 업로드 삭제 때 override 를 지울 소유 FK 도 사라진다. 그래서 유지했다.
- user_fact.batch_id
  - A1b 에서 NOT NULL 을 걸 때 빈 행을 채우거나 지우지 않고 바로 건다. 운영 코드는 user_fact 에 쓰지 않아 0행이어야 하고, 행이 있으면 마이그레이션이 실패해 드러난다.
  - 채울 수도 없다. `transaction:` 범위 답변만 거래로 batch 를 찾을 수 있고, `merchant:`·사용자 범위 답변은 어느 batch 인지 정할 수 없다.

## 확인한 것

- 새 테스트 두 개는 고치기 전 V7 에서 실패하고, 고친 뒤 통과하는 것을 확인했다.
- `test`·`integrationTest` 전부 통과(206개).
- 빈 Postgres 17 에 V1~V5, V7 을 적용해 스키마를 뽑고, 그 결과로 PR 본문 ERD(mermaid)를 만들었다. mermaid CLI 로 그려지는 것도 확인했다.

## 남은 것 · 아는 문제

- V7 내용이 바뀌었다. 로컬 DB 에 이전 V7 을 적용한 사람은 Flyway 체크섬 불일치로 기동이 막히니 DB 를 다시 만들어야 한다.
- A1b 배포 전에 운영에서 `select count(*) from user_fact where batch_id is null` 이 0 인지 확인한다.
- 마이그레이션 번호 V7 은 B2(#84, V6)가 먼저 머지된다는 가정 그대로다.
- PR 리뷰 댓글에는 아직 답하지 않았다.
