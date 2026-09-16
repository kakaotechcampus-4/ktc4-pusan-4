-- 범위 밖 핸드오프(R-070 차량 · R-071 급여원천세)를 확인필요와 구분해 저장한다.
-- verdict 의 네 번째 값으로 두면 제한 강도 순서(가능<확인필요<불가)가 깨진다.
-- 범위 밖은 불가보다 더/덜 제한적인 게 아니라 판정과 축이 다른 사유라 별도 컬럼이다.
--
-- unmatched_reason 을 재사용하지 않는다. 그 값이 있으면 unmatched_log 에 행이 쌓이는데,
-- 범위 밖 카드는 매칭에 성공한 카드라 미매칭 학습 루프를 오염시킨다.
ALTER TABLE judgment
    ADD COLUMN is_out_of_scope boolean NOT NULL DEFAULT false;

-- 범위 밖은 판정을 포기한 상태다. 가능·불가로 답한 판정이 동시에 넘길 수는 없다.
ALTER TABLE judgment
    ADD CONSTRAINT judgment_out_of_scope_needs_review
    CHECK (NOT is_out_of_scope OR verdict = 'NEEDS_REVIEW');
