-- 답 취소 (api.md 3.10 답 취소). UserFact 는 고치지 않고 version 을 쌓으므로, 취소도 새 version 으로 남긴다.
-- 최신 version 이 취소면 그 (batch, scope, factType) 에는 답이 없는 것으로 판정한다. 값은 빈 객체다.
-- 기존 행은 모두 답이다.
ALTER TABLE user_fact
    ADD COLUMN withdrawn boolean NOT NULL DEFAULT false,
    ADD CONSTRAINT user_fact_withdrawn_value_check CHECK (NOT withdrawn OR value = '{}'::jsonb);
