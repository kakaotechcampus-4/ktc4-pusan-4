-- transaction 을 업로드·거래 계약(api.md §2.2~2.4, §3.3, §3.4)에 맞춘다.
--
-- 이전 코드 호환 (db/README.md "이전 코드와 호환되게 쓴다")
-- 이 마이그레이션 이전의 백엔드는 transaction 에 행을 쓰지 않는다. 업로드는 목 응답이고
-- TransactionRecordEntity 는 id·batch_id 만 매핑한다. 그래서 이전 이미지로 롤백해도
-- status 삭제는 validate 를 깨지 않고, 새 NOT NULL·제약을 어기는 INSERT 도 없다.
-- 이미 행이 있는 DB 를 위해 "컬럼 추가 → 기존 행 채우기 → 제약" 순서로 쓴다.

-- 1) 소유자. user_id 를 batch 에서 채운다.
--    (batch_id, user_id) 를 upload_batch 의 (id, user_id) 에 묶어 거래와 batch 의 소유자가
--    어긋날 수 없게 한다. app_user 존재는 upload_batch.user_id FK 가 보장한다.
ALTER TABLE upload_batch
    ADD CONSTRAINT upload_batch_id_user_id_key UNIQUE (id, user_id);

ALTER TABLE transaction ADD COLUMN user_id uuid;

UPDATE transaction t
SET user_id = b.user_id
FROM upload_batch b
WHERE b.id = t.batch_id;

ALTER TABLE transaction ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE transaction
    ADD CONSTRAINT transaction_batch_user_fkey
    FOREIGN KEY (batch_id, user_id) REFERENCES upload_batch(id, user_id) ON DELETE CASCADE;

-- 2) 중복 판단은 사용자 단위다. 다른 사용자가 같은 naturalKey 를 올려도 다른 거래다.
ALTER TABLE transaction DROP CONSTRAINT transaction_natural_key_key;

ALTER TABLE transaction
    ADD CONSTRAINT transaction_user_id_natural_key_key UNIQUE (user_id, natural_key);

-- 3) status 하나를 세 축으로 나눈다.
--    source_status: 파서가 정한 원본 상태 (§2.2). 원본 이력이라 사용자 조작으로 바꾸지 않는다.
--    user_inclusion: 사용자의 포함·제외 (§2.3). effectiveStatus 는 저장하지 않고 이 둘로 계산한다.
--    classification_status: 가맹점 분류 상태 (§2.4).
--    값은 응답의 code 와 같은 영문 enum 이름으로 저장한다 (judgment.verdict 와 같은 방식).
ALTER TABLE transaction
    ADD COLUMN source_status varchar(20),
    ADD COLUMN user_inclusion varchar(20) NOT NULL DEFAULT 'AUTO',
    ADD COLUMN classification_status varchar(20);

UPDATE transaction
SET source_status = CASE status
        WHEN '판정대상' THEN 'JUDGEABLE'
        WHEN '취소상계' THEN 'CANCELED_OFFSET'
        WHEN '대상제외' THEN 'EXCLUDED'
    END,
    classification_status = CASE
        WHEN merchant_category = '미분류' THEN 'NEEDS_REVIEW'
        ELSE 'CLASSIFIED'
    END;

ALTER TABLE transaction
    ALTER COLUMN source_status SET NOT NULL,
    ALTER COLUMN classification_status SET NOT NULL,
    ADD CONSTRAINT transaction_source_status_check
        CHECK (source_status IN ('JUDGEABLE', 'CANCELED_OFFSET', 'EXCLUDED')),
    ADD CONSTRAINT transaction_user_inclusion_check
        CHECK (user_inclusion IN ('AUTO', 'INCLUDED', 'EXCLUDED')),
    ADD CONSTRAINT transaction_classification_status_check
        CHECK (classification_status IN ('CLASSIFIED', 'NEEDS_REVIEW')),
    -- 취소상계는 사용자가 포함으로 바꿀 수 없다 (§2.3, 409 CANCELED_TRANSACTION_NOT_INCLUDABLE).
    ADD CONSTRAINT transaction_canceled_offset_not_included
        CHECK (NOT (source_status = 'CANCELED_OFFSET' AND user_inclusion = 'INCLUDED')),
    -- 미분류이면 분류 확인 필요다 (§2.4). 반대 방향(확인 필요면 미분류)은 계약에 없어 걸지 않는다.
    ADD CONSTRAINT transaction_unclassified_needs_review
        CHECK (merchant_category <> '미분류' OR classification_status = 'NEEDS_REVIEW');

ALTER TABLE transaction DROP COLUMN status;

-- 4) 일시불은 0 이다 (파서 규칙, docs/schema_mapping.md §1). 기존 행의 값은 바꾸지 않는다.
ALTER TABLE transaction ALTER COLUMN installment_months SET DEFAULT 0;

ALTER TABLE transaction DROP CONSTRAINT transaction_installment_months_check;

ALTER TABLE transaction
    ADD CONSTRAINT transaction_installment_months_check CHECK (installment_months >= 0);

-- 5) 업로드로 받는 파서 필드 (§3.3 transactions[], docs/schema_mapping.md §3). 전부 선택값이다.
ALTER TABLE transaction
    ADD COLUMN approval_no varchar(32),
    ADD COLUMN biz_no varchar(20),
    ADD COLUMN branch text,
    ADD COLUMN branch_raw text,
    ADD COLUMN memo text,
    ADD COLUMN is_aggregated boolean NOT NULL DEFAULT false,
    ADD COLUMN needs_review boolean NOT NULL DEFAULT false,
    ADD COLUMN review_reason text,
    ADD COLUMN source_card varchar(20);

-- 6) batchId 없이 사용자 전체 거래를 보는 목록 조회(§3.4, approvedAt DESC, id DESC)용.
CREATE INDEX idx_transaction_user_approved_at
    ON transaction(user_id, approved_at DESC, id DESC);
