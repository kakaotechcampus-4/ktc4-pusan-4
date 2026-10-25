-- 연쇄 삭제가 타는 FK 칸에 인덱스를 건다 (docs/architecture.md "삭제 정책").
--
-- 탈퇴·batch 삭제는 ON DELETE CASCADE 로 지운다. Postgres 는 지워지는 부모 행마다
-- 자식 테이블을 FK 칸으로 한 번씩 찾고, 커밋 때 검사하는 참조 FK 도 지워진 부모 행마다 찾는다.
-- 아래 4개 칸은 쓸 수 있는 인덱스가 없어 그때마다 자식 테이블 전체를 읽었다.
-- 로컬 PG16 측정(사용자 100명 × 판정 3,000건)에서 사용자 하나 삭제가 30~33초에서 0.8~1.2초가 됐다.
-- 대신 INSERT 가 행당 5~13µs 정도 느려진다(판정 3,000건 run 당 약 20ms).
--
-- judgment_run.context_id 도 인덱스가 없지만 run 은 batch 당 몇 개라 두지 않는다.
--
-- 이전 코드 호환: 인덱스만 더하므로 이전 코드의 validate·INSERT 어느 쪽도 깨지 않는다.

-- 판정 → 질문 CASCADE.
CREATE INDEX idx_question_queue_judgment ON question_queue(judgment_id);

-- 답변 fact 참조 FK. user_fact 가 지워지면 커밋 때 이 칸으로 남은 질문을 찾는다.
CREATE INDEX idx_question_queue_answered_fact ON question_queue(answered_fact_id);

-- 판정 → 한도 버킷 CASCADE. UNIQUE(user_id, tax_year, bucket_code, judgment_id) 는 judgment_id 가
-- 넷째 칸이라 이 조회에 못 쓴다.
CREATE INDEX idx_limit_bucket_entry_judgment ON limit_bucket_entry(judgment_id);

-- 거래 → override CASCADE. uq_judgment_override_active_transaction 은 WHERE active 부분 인덱스라
-- 해제된 override 까지 찾는 이 조회에 못 쓴다.
CREATE INDEX idx_judgment_override_transaction ON judgment_override(transaction_id);
