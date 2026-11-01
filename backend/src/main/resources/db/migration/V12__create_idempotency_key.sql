-- 업로드 Idempotency-Key (api.md §1.6, docs/backend_api_plan.md B5).
--
-- 번호: V11 은 열린 PR #128(judgment_run.last_progress_at)이 쓴다. 겹치지 않게 V12 로 두고 그쪽이 먼저 머지되는 걸 전제한다.
--
-- 이전 코드 호환 (db/README.md "이전 코드와 호환되게 쓴다")
-- 새 테이블만 만든다. 이전 코드는 이 테이블을 모르므로 롤백해도 validate·INSERT 어느 쪽도 깨지지 않는다.
--
-- 최초 응답 스냅샷은 응답 필드를 컬럼으로 둔다. batch id 는 batch_id 다.
-- 삭제 상태는 따로 두지 않는다. batch 가 지워지면 batch_id 가 NULL 이 되고, 그게 DELETED(410)다.
-- 그래서 batch 삭제(B6)는 이 테이블을 신경 쓰지 않아도 된다.
CREATE TABLE idempotency_key (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    idempotency_key varchar(128) NOT NULL,
    -- 정규화한 요청 본문의 SHA-256 (hex). 같은 키 + 다른 payload 를 409 로 가른다.
    request_hash varchar(64) NOT NULL,
    -- NULL = batch 가 삭제됨. 같은 키로 다시 오면 410 IDEMPOTENCY_RESULT_DELETED.
    batch_id uuid REFERENCES upload_batch(id) ON DELETE SET NULL,
    transaction_count integer NOT NULL CHECK (transaction_count >= 0),
    skipped_duplicate_count integer NOT NULL CHECK (skipped_duplicate_count >= 0),
    classification_pending_count integer NOT NULL CHECK (classification_pending_count >= 0),
    -- 최초 응답의 createdAt (= batch 생성 시각). batch 가 지워져도 남는다.
    response_created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (expires_at > response_created_at),
    UNIQUE (user_id, idempotency_key)
);

-- ON DELETE SET NULL 이 batch 삭제마다 이 테이블을 찾는다.
CREATE INDEX idx_idempotency_key_batch ON idempotency_key(batch_id);
