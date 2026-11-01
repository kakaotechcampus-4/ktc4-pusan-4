-- 답의 출처 (api.md 3.10 source). 지난번 답 불러오기(3.14)가 일괄 응답을 약한 근거로 다룰 때 쓴다.
-- 기존 행은 사용자가 직접 한 답으로 본다.
ALTER TABLE user_fact
    ADD COLUMN source varchar(20) NOT NULL DEFAULT 'USER',
    ADD CONSTRAINT user_fact_source_check CHECK (source IN ('USER', 'ASSISTANT', 'PREVIOUS_ANSWER', 'BULK'));
