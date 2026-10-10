# 연쇄 삭제가 타는 FK 4개에 인덱스를 건다

- 브랜치: perf/fk-indexes-for-cascade-delete
- 커밋: 83ebfe8 (1개)
- 주요파일: V9__index_fk_columns_for_cascade_delete.sql

## 한 일

- V9 마이그레이션으로 인덱스 4개를 더했다. 스키마의 다른 부분은 바꾸지 않았다.
  - `idx_question_queue_judgment` — `question_queue(judgment_id)`
  - `idx_question_queue_answered_fact` — `question_queue(answered_fact_id)`
  - `idx_limit_bucket_entry_judgment` — `limit_bucket_entry(judgment_id)`
  - `idx_judgment_override_transaction` — `judgment_override(transaction_id)`

## 왜 이렇게 했나

- 탈퇴는 `DELETE FROM app_user` 하나로 지우고 나머지는 DB 의 `ON DELETE CASCADE` 가 지운다(V7, docs/architecture.md "삭제 정책").
  Postgres 는 지워지는 부모 행마다 자식 테이블을 FK 칸으로 한 번씩 찾는다. 커밋 때 검사하는 참조 FK 도 지워진 부모 행마다 찾는다.
- 위 4개 칸은 쓸 수 있는 인덱스가 없어서 단계마다 자식 테이블 전체를 읽었다.
  - `question_queue.judgment_id`, `answered_fact_id` 에는 인덱스가 아예 없다. `answered_fact_id` 는 커밋 때 검사하는 참조 FK 다.
  - `limit_bucket_entry.judgment_id` 는 `UNIQUE(user_id, tax_year, bucket_code, judgment_id)` 의 넷째 칸이라 이 조회에 못 쓴다.
  - `judgment_override.transaction_id` 에는 `WHERE active` 부분 인덱스만 있어서 해제된 override 까지 찾는 조회에 못 쓴다.
- 측정: 로컬 PG16 에 V1~V7 을 적용하고 사용자 100명 × 거래·판정 3,000건(판정 30만, question_queue 6만, limit_bucket_entry 약 10만, override 1.2만)을 넣었다. 사용자 하나를 지우고 롤백하기를 2번 했다.

  | | 인덱스 전 | 인덱스 후 |
  |---|---|---|
  | DELETE 문 | 30.0~32.9초 | 0.77~1.2초 |
  | 커밋 때 참조 FK 검사 | 0.44~0.50초 | 0.06~0.34초 |

  - 전의 DELETE 시간 대부분은 `limit_bucket_entry_judgment_id_fkey` 18.4초, `question_queue_judgment_id_fkey` 9.0초, `judgment_override_transaction_id_fkey` 0.74초였다.
  - batch 삭제도 같은 CASCADE 경로를 타서 같이 빨라진다.
- 대가는 쓰기다. 3번씩 잰 중앙값, 전 → 후:
  - question_queue 6만 행 INSERT 0.69 → 1.29초
  - limit_bucket_entry 10만 행 INSERT 2.63 → 3.96초
  - judgment_override 1.2만 행 INSERT 0.16 → 0.22초
  - 질문 3만 건 답변(`answered_fact_id` UPDATE, 인덱스 칸이 바뀌어 HOT 업데이트를 못 탄다) 0.26 → 0.58초
  - 행당 5~13µs 정도, 판정 3,000건 run 하나에 약 20ms 다. 탈퇴 한 번이 30초씩 걸리는 것보다 낫다고 봤다.
- `judgment_run.context_id` 도 인덱스가 없지만 걸지 않았다. run 은 batch 당 몇 개뿐이라 전체를 읽어도 싸다.
- 이전 코드 호환: 인덱스만 더하므로 롤백한 이전 코드의 validate·INSERT 어느 쪽도 깨지 않는다.

## 확인한 것

- `test` 193건, `integrationTest` 44건(`JudgmentSchemaIntegrationTest` 32건 포함) 모두 통과. Testcontainers 로그에서 V9 가 적용된 것을 확인했다.

## 남은 것 · 아는 문제

- 측정은 개인 PC 에서 했고 실행마다 최대 1.7배까지 흔들린다. 숫자는 크기 비교로만 본다.
- 측정 DB 는 V1~V7 기준이다. V8(transaction 에 user_id 등 추가) 위에서 다시 재지는 않았다.
- 운영 RDS 에서는 재지 않았다. 운영 테이블 크기에서 V9 의 `CREATE INDEX` 가 걸리는 시간과 쓰기 잠금도 확인하지 않았다.
- 탈퇴가 빨라지는 것을 고정하는 테스트는 넣지 않았다. 위 측정은 저장소 밖 일회용 DB 에서 했다.
