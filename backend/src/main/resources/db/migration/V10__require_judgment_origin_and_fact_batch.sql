-- V7 에서 nullable 로 열어 둔 두 값을 필수로 조인다. 저장 코드가 이제 둘 다 채운다.
--
-- 이전 코드 호환 (db/README.md "이전 코드와 호환되게 쓴다")
-- 이전 코드는 judgment·user_fact 에 쓰는 운영 경로가 없다(저장 서비스는 테스트만 부른다).
-- 그래서 이전 이미지로 롤백해도 새 제약을 어기는 INSERT 가 나오지 않는다.
-- 기존 행이 있으면 제약 추가가 실패한다. origin·batch 를 지어낼 근거가 없으므로
-- 채우지 않고 실패하게 둔다. 배포 전에 운영 DB 의 두 테이블 행 수가 0 인지 확인한다.

-- 1) 모든 revision 은 직접 origin 을 정확히 하나 가진다 (api.md §4).
ALTER TABLE judgment
    ADD CONSTRAINT judgment_has_one_origin
    CHECK (num_nonnulls(run_id, trigger_user_fact_id, classification_review_id, judgment_override_id) = 1);

-- 2) UserFact 는 batch 범위다 (api.md §3.10). 버전도 batch 안에서 매긴다.
ALTER TABLE user_fact ALTER COLUMN batch_id SET NOT NULL;

ALTER TABLE user_fact
    DROP CONSTRAINT user_fact_user_id_scope_key_fact_type_version_key,
    ADD CONSTRAINT user_fact_user_id_batch_id_scope_key_fact_type_version_key
        UNIQUE (user_id, batch_id, scope_key, fact_type, version);

-- fact 와 batch 의 소유자가 어긋날 수 없게 한다. transaction 의 V8 복합 FK 와 같은 방식이다.
ALTER TABLE user_fact
    ADD CONSTRAINT user_fact_batch_user_fkey
    FOREIGN KEY (batch_id, user_id) REFERENCES upload_batch(id, user_id) ON DELETE CASCADE;

-- 최신값 조회 인덱스는 위 UNIQUE 의 인덱스가 같은 열 순서로 대신한다.
DROP INDEX idx_user_fact_latest;
