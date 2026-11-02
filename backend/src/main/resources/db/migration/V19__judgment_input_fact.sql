-- 판정에 쓴 답을 복사본(judgment.input_facts jsonb) 대신 user_fact 참조로 남긴다.
--
-- input_facts 는 판정 행마다 batch 의 최신 답 전부를 복사했다. 답이 쌓이면 행 수 × 답 수로 커져서
-- 거래 3,000건의 질문에 다 답한 batch 는 요약·내보내기가 판정을 읽다가 힙 768MB 에서 OutOfMemoryError 가 났다.
-- 복사본에는 답의 id·version·source 도 없어 어느 답이 쓰였는지 되짚을 수 없었다.
-- user_fact 는 고치지 않고 version 을 쌓으므로 id 로 가리키면 판정 당시 답이 그대로 남는다.
--
-- 이제 질문을 실제로 푼 답만 남긴다. 기존 input_facts 는 옮기지 않는다. 운영 데이터가 없고 쓰는 곳도 없다.

CREATE TABLE judgment_input_fact (
    judgment_id uuid NOT NULL REFERENCES judgment(id) ON DELETE CASCADE,
    -- 참조 FK 는 지우지 않고 막고, 커밋 때 검사한다 (V7 4)). 답과 판정은 batch·탈퇴 삭제로 함께 지워진다.
    user_fact_id uuid NOT NULL REFERENCES user_fact(id) DEFERRABLE INITIALLY DEFERRED,
    PRIMARY KEY (judgment_id, user_fact_id)
);

-- user_fact 가 지워지면 커밋 때 이 칸으로 남은 행을 찾는다 (V9).
CREATE INDEX idx_judgment_input_fact_user_fact ON judgment_input_fact(user_fact_id);

ALTER TABLE judgment DROP COLUMN input_facts;
