# 거래 스키마를 업로드·거래 계약에 맞춘다 (B2)

- 브랜치: feature/transaction-schema
- 커밋: 1개
- 주요파일: V8__align_transaction_with_upload_contract.sql, TransactionRecordEntity.java, UploadBatchEntity.java, JudgmentSchemaIntegrationTest.java

## 한 일

- `transaction` 마이그레이션 V8 (docs/backend_api_plan.md B2)
  - `user_id` 추가 → batch 에서 채움 → `NOT NULL` → `(batch_id, user_id)` 를 `upload_batch(id, user_id)` 에 FK 로 묶음
  - `UNIQUE(natural_key)` → `UNIQUE(user_id, natural_key)`
  - `status` 를 `source_status`·`user_inclusion`(기본 AUTO)·`classification_status` 로 나누고 기존 값을 옮긴 뒤 `status` 삭제
  - CHECK 추가: 세 컬럼 허용값, 취소상계는 INCLUDED 불가, 미분류이면 NEEDS_REVIEW
  - `installment_months` 기본값 0, CHECK `>= 0`
  - 업로드 필드 9개 추가: `approval_no`, `biz_no`, `branch`, `branch_raw`, `memo`, `is_aggregated`, `needs_review`, `review_reason`, `source_card`
  - 사용자 전체 거래 목록용 인덱스 `(user_id, approved_at DESC, id DESC)`
- `TransactionRecordEntity`·`UploadBatchEntity` 에 전체 컬럼 매핑
- 통합 테스트: 기존 거래 삽입 헬퍼를 새 컬럼으로 바꾸고 5개 추가
  (다른 사용자 같은 키 허용, batch 소유자 불일치 거부, 기본값, 취소상계 포함 거부, 미분류 분류완료 거부)
- docs/architecture.md natural_key 절을 사용자 단위 UNIQUE 로 고침

## 왜 이렇게 했나

- `user_id` 를 batch 에서 가져오기만 하면 둘이 어긋나도 막을 수 없다. 복합 FK 로 묶으면 DB 가 보장한다.
- `status` 를 같은 배포에서 지웠다. 이전 코드는 transaction 에 쓰지 않고 엔티티도 `id`·`batch_id` 만 매핑해서, 롤백해도 validate·INSERT 어느 쪽도 안 깨진다(db/README.md 호환 표).
- 상태값은 한글이 아니라 응답 code(`JUDGEABLE` 등)로 저장한다. `judgment.verdict` 와 같은 방식이다.
- 미분류 CHECK 는 한 방향만 건다. api.md 2.4 는 "미분류이면 NEEDS_REVIEW" 만 정하고, 카테고리가 있는데 확인이 필요한 경우(B10 저신뢰 추천 등)를 막지 않는다.
- `installment_months` 기존 값은 바꾸지 않았다. 마이그레이션 안 UPDATE 로 의미를 바꾸면 안 된다(db/README.md).
- 엔티티 상태 필드는 `JudgmentEntity` 처럼 문자열로 뒀다. 쓰는 코드(B4)가 생길 때 변환 위치를 정한다.

## 확인한 것

- 로컬 Postgres 16 에 V1~V5 적용 → 행 3개 삽입 → V6 적용(이름 변경 전). 기존 값이 새 컬럼으로 옮겨짐(판정대상/취소상계/대상제외, 미분류→NEEDS_REVIEW).
- develop(V7) 기준 rebase 후 V8 로 이름 변경. 빈 DB 에 V1~V8 적용(integrationTest 42건 통과).
- 제약 11가지를 SQL 로 직접 확인(중복 키, 소유자 불일치, 취소상계 포함, 미분류, 허용값, 할부 음수, 기본값, batch 삭제 연쇄 등).
- 두 엔티티의 컬럼 이름이 V8 이후 테이블 컬럼과 정확히 같음.
- `gradlew test`·`integrationTest` 는 작업 환경에서 Gradle·Docker 이미지를 받을 수 없어 돌리지 못했다. PR 전에 로컬에서 돌려야 한다.

## 남은 것 · 아는 문제

- 운영 DB 에 `transaction` 행이 있는지 배포 전에 확인할 것. 있으면 `installment_months` 가 옛 기본값 1(일시불)로 남는다.
- `transaction.user_id` 의 `app_user` 삭제 정책은 A1a 삭제 정책 설계에 맡긴다. 지금은 batch 를 거쳐서만 연결된다.
- effectiveStatus 계산과 상태 enum 변환은 쓰는 쪽(A2a, B4, B7)에서 만든다.
