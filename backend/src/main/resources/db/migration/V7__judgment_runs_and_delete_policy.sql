-- 판정 실행·이력 테이블과 삭제 정책 (api.md §4 origin, §6 삭제, §7 테이블).
--
-- 이전 코드 호환 (db/README.md "이전 코드와 호환되게 쓴다")
-- 이 마이그레이션 이전의 백엔드는 judgment·question_queue·user_fact 에 행을 쓰지 않는다.
-- JudgmentService·UserFactPersistenceService 를 부르는 운영 코드가 없고 API 는 목 응답이다.
-- 그래서 judgment.state 삭제(엔티티가 매핑하지 않음)와 question_queue.status 값 변경은
-- 롤백해도 validate·INSERT 어느 쪽도 깨지 않는다.
-- 이전 코드의 INSERT 를 깨는 제약(origin 정확히 하나, user_fact.batch_id NOT NULL)은
-- 저장 코드가 그 값을 채우는 다음 마이그레이션에서 건다.

-- 1) 판정 실행. 한 batch 에 여러 번 돌 수 있다 (api.md §3.6).
--    context_version 은 run 을 만든 시점의 문진 버전을 고정한다. 재판정이 이 값을 다시 쓴다.
--    context_id 는 소유가 아니라 참조라 CASCADE 가 아니다. 아래 4) 의 "참조 FK" 설명을 본다.
CREATE TABLE judgment_run (
    id uuid PRIMARY KEY,
    batch_id uuid NOT NULL REFERENCES upload_batch(id) ON DELETE CASCADE,
    context_id uuid NOT NULL REFERENCES user_context(id) DEFERRABLE INITIALLY DEFERRED,
    context_version integer NOT NULL CHECK (context_version > 0),
    status varchar(20) NOT NULL
        CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL_FAILED', 'FAILED')),
    total_count integer NOT NULL DEFAULT 0 CHECK (total_count >= 0),
    processed_count integer NOT NULL DEFAULT 0 CHECK (processed_count >= 0),
    failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz,
    completed_at timestamptz
);

CREATE INDEX idx_judgment_run_batch_created_at
    ON judgment_run(batch_id, created_at DESC);

-- run 대상 거래와 건별 결과. 대상은 run 을 만들 때 PENDING 으로 고정한다.
-- 그래야 totalCount 와 실제 처리 대상이 어긋나지 않는다.
-- PENDING 은 내부 상태이고 API 는 SUCCEEDED·FAILED 만 보인다 (NEEDS_REVIEW 판정도 SUCCEEDED).
-- processed_at 은 /failures 의 failedAt 이다.
CREATE TABLE judgment_run_item (
    run_id uuid NOT NULL REFERENCES judgment_run(id) ON DELETE CASCADE,
    transaction_id uuid NOT NULL REFERENCES transaction(id) ON DELETE CASCADE,
    status varchar(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED')),
    error_code varchar(50),
    error_message text,
    processed_at timestamptz,
    PRIMARY KEY (run_id, transaction_id),
    CONSTRAINT judgment_run_item_failure_has_error
        CHECK (status <> 'FAILED' OR error_code IS NOT NULL)
);

CREATE INDEX idx_judgment_run_item_transaction
    ON judgment_run_item(transaction_id);

-- 2) 미분류 거래의 분류 확인 요청 (api.md §2.6, §3.5).
CREATE TABLE classification_review (
    id uuid PRIMARY KEY,
    transaction_id uuid NOT NULL REFERENCES transaction(id) ON DELETE CASCADE,
    status varchar(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'RESOLVED')),
    selected_category varchar(50),
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    CONSTRAINT classification_review_resolved_has_category
        CHECK (status <> 'RESOLVED' OR (selected_category IS NOT NULL AND resolved_at IS NOT NULL))
);

CREATE INDEX idx_classification_review_transaction
    ON classification_review(transaction_id);

-- 3) 사용자 판정 수정 (api.md §3.8). 해제해도 지우지 않고 active=false 로 남긴다.
--    transaction_id 는 "거래당 활성 Override 하나"를 DB 가 보장하려고 둔다.
--    부분 UNIQUE 를 걸 컬럼이 이 테이블에 있어야 한다.
--    source_judgment_id 는 소유가 아니라 참조라 CASCADE 가 아니다. 아래 4) 의 "참조 FK" 설명을 본다.
--    원래 판정은 같은 거래의 판정이어야 해서 (source_judgment_id, transaction_id) 쌍으로 묶는다.
ALTER TABLE judgment
    ADD CONSTRAINT judgment_id_transaction_id_key UNIQUE (id, transaction_id);

CREATE TABLE judgment_override (
    id uuid PRIMARY KEY,
    transaction_id uuid NOT NULL REFERENCES transaction(id) ON DELETE CASCADE,
    source_judgment_id uuid NOT NULL,
    to_verdict varchar(30) NOT NULL
        CHECK (to_verdict IN ('AVAILABLE', 'UNAVAILABLE', 'NEEDS_REVIEW')),
    reason text,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    released_at timestamptz,
    CONSTRAINT judgment_override_released_is_inactive
        CHECK (active = (released_at IS NULL)),
    CONSTRAINT judgment_override_source_judgment_id_fkey
        FOREIGN KEY (source_judgment_id, transaction_id) REFERENCES judgment(id, transaction_id)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE UNIQUE INDEX uq_judgment_override_active_transaction
    ON judgment_override(transaction_id) WHERE active;

CREATE INDEX idx_judgment_override_source_judgment
    ON judgment_override(source_judgment_id);

-- 4) judgment revision 의 직접 원인 (api.md §4). 다형 origin_type/origin_id 대신 실제 FK 4개를 둔다.
--    지금은 nullable 이다. "정확히 하나" CHECK 는 저장 코드가 origin 을 채운 뒤 건다.
--
--    참조 FK (origin 4개, run.context_id, override.source_judgment_id, question_queue.answered_fact_id)
--    판정은 거래를 거쳐서만 지워진다(transaction → judgment CASCADE). 참조 FK 까지 CASCADE 면
--    잘못 이어진 참조 하나(다른 batch 의 run 을 가리키는 판정 등)가 다른 batch 의 이력을 조용히 지운다.
--    그래서 참조 FK 는 지우지 않고 막는다(NO ACTION). DEFERRABLE INITIALLY DEFERRED 로 커밋 때 검사한다.
--    즉시 검사하면 탈퇴처럼 여러 경로로 함께 지워질 때 순서에 따라 아직 남은 행에 걸려 실패한다
--    (user_fact 가 판정보다 먼저 지워지는 경우를 테스트로 확인).
ALTER TABLE judgment
    ADD COLUMN run_id uuid REFERENCES judgment_run(id) DEFERRABLE INITIALLY DEFERRED,
    ADD COLUMN trigger_user_fact_id uuid REFERENCES user_fact(id) DEFERRABLE INITIALLY DEFERRED,
    ADD COLUMN classification_review_id uuid
        REFERENCES classification_review(id) DEFERRABLE INITIALLY DEFERRED,
    ADD COLUMN judgment_override_id uuid REFERENCES judgment_override(id) DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX idx_judgment_run ON judgment(run_id);
CREATE INDEX idx_judgment_trigger_user_fact ON judgment(trigger_user_fact_id);
CREATE INDEX idx_judgment_classification_review ON judgment(classification_review_id);
CREATE INDEX idx_judgment_override ON judgment(judgment_override_id);

-- 잠정/확정은 limit_bucket_entry 가 관리한다 (api.md "Judgment state 제거").
ALTER TABLE judgment DROP COLUMN state;

-- 5) 질문 상태를 API code 와 같은 영문 값으로 저장한다 (judgment.verdict 와 같은 방식).
ALTER TABLE question_queue
    DROP CONSTRAINT question_queue_status_check,
    DROP CONSTRAINT question_queue_check;

UPDATE question_queue
SET status = CASE status
        WHEN '대기' THEN 'PENDING'
        WHEN '응답' THEN 'ANSWERED'
        WHEN '취소' THEN 'CANCELED'
    END;

ALTER TABLE question_queue
    ALTER COLUMN status SET DEFAULT 'PENDING',
    ADD CONSTRAINT question_queue_status_check
        CHECK (status IN ('PENDING', 'ANSWERED', 'CANCELED')),
    ADD CONSTRAINT question_queue_answered_has_fact
        CHECK (status <> 'ANSWERED' OR (answered_fact_id IS NOT NULL AND answered_at IS NOT NULL));

-- 6) UserFact 는 batch 범위다 (api.md §3.10). NOT NULL 과 UNIQUE 교체는 저장 코드가 batch 를 받은 뒤 한다.
--    그때 batch_id 가 빈 기존 행은 채우지도 지우지도 않고 바로 NOT NULL 을 건다.
--    운영 코드가 user_fact 에 쓰지 않아 0행이어야 하고, 행이 있으면 마이그레이션이 실패해 드러난다.
--    채울 수도 없다. merchant·사용자 범위 답변은 어느 batch 의 것인지 정할 수 없다.
ALTER TABLE user_fact
    ADD COLUMN batch_id uuid REFERENCES upload_batch(id) ON DELETE CASCADE;

CREATE INDEX idx_user_fact_batch ON user_fact(batch_id);

-- 7) 삭제 정책 (api.md §6). batch 를 지우면 그 업로드에서 파생된 데이터가 모두 지워진다.
--    transaction → judgment 가 막혀 있어서, 판정이 하나라도 있는 batch 는 지워지지 않았다.
ALTER TABLE judgment
    DROP CONSTRAINT judgment_transaction_id_fkey,
    ADD CONSTRAINT judgment_transaction_id_fkey
        FOREIGN KEY (transaction_id) REFERENCES transaction(id) ON DELETE CASCADE;

-- 답변 fact 도 참조 FK 다(4) 참고). 질문은 판정과 함께 지워지고, fact 는 batch 와 함께 지워진다.
-- 커밋 때 검사하므로 두 경로로 함께 지워져도 통과한다.
-- SET NULL 로 두면 "ANSWERED 면 fact 필수" CHECK 와 부딪힌다.
ALTER TABLE question_queue
    DROP CONSTRAINT question_queue_answered_fact_id_fkey,
    ADD CONSTRAINT question_queue_answered_fact_id_fkey
        FOREIGN KEY (answered_fact_id) REFERENCES user_fact(id) DEFERRABLE INITIALLY DEFERRED;

-- 탈퇴(DELETE /users/me)하면 사용자 소유 데이터를 모두 지운다. 공용 statute_version·전역 merchant_dict 는 남는다.
ALTER TABLE user_context
    DROP CONSTRAINT user_context_user_id_fkey,
    ADD CONSTRAINT user_context_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE;

ALTER TABLE upload_batch
    DROP CONSTRAINT upload_batch_user_id_fkey,
    ADD CONSTRAINT upload_batch_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE;

ALTER TABLE user_fact
    DROP CONSTRAINT user_fact_user_id_fkey,
    ADD CONSTRAINT user_fact_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE;

ALTER TABLE merchant_dict
    DROP CONSTRAINT merchant_dict_user_id_fkey,
    ADD CONSTRAINT merchant_dict_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE;

ALTER TABLE limit_bucket_entry
    DROP CONSTRAINT limit_bucket_entry_user_id_fkey,
    ADD CONSTRAINT limit_bucket_entry_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE;
