-- 거래마다 현재 판정(api.md §5)을 가리킨다: 활성 override 가 있으면 그 override revision, 없으면 override 가 아닌
-- 최신 revision. 읽을 때마다 이 규칙을 상관 서브쿼리로 풀면 플래너가 1행으로 잘못 추정해 계획이 나빠졌다(#218).
-- 판정 저장(JudgmentService)·override·해제(JudgmentOverrideService)가 거래 락을 잡고 바꾼다. 판정이 없으면 비어 있다.
--
-- 참조 FK 라 V7 의 정책대로 지우지 않고 막으며(NO ACTION) 커밋 때 검사한다. override.source_judgment_id 처럼
-- 같은 거래의 판정만 가리키도록 (current_judgment_id, id) 쌍으로 judgment(id, transaction_id) 를 참조한다.
ALTER TABLE transaction
    ADD COLUMN current_judgment_id uuid,
    ADD CONSTRAINT transaction_current_judgment_fkey
        FOREIGN KEY (current_judgment_id, id) REFERENCES judgment(id, transaction_id)
        DEFERRABLE INITIALLY DEFERRED;

-- 판정이 지워질 때(거래 → 판정 CASCADE) 이 FK 를 확인하려고 거래를 훑지 않게 한다(V9 와 같은 이유).
CREATE INDEX idx_transaction_current_judgment ON transaction(current_judgment_id);

UPDATE transaction t
SET current_judgment_id = (
    SELECT j.id
    FROM judgment j
    WHERE j.transaction_id = t.id
      AND (
        j.judgment_override_id = (
          SELECT o.id FROM judgment_override o WHERE o.transaction_id = t.id AND o.active
        )
        OR (
          j.judgment_override_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM judgment_override o WHERE o.transaction_id = t.id AND o.active)
        )
      )
    ORDER BY j.revision DESC
    LIMIT 1
);
