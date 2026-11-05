-- 분류 모델(B10)이 미분류 거래에 낸 답의 감사 기록 (docs/backend_api_plan.md B10).
-- 모델 답은 merchant_dict 에 쓰지 않고 여기에만 남긴다. 분류 확인 화면의 suggestedCategories 도 여기서 읽는다.
--
-- 이전 코드 호환 (db/README.md "이전 코드와 호환되게 쓴다")
-- 새 테이블만 만든다. 이전 코드는 이 테이블을 모르므로 롤백해도 validate·INSERT 어느 쪽도 깨지지 않는다.
--
-- category·model 은 모델이 준 문자열 그대로라 길이를 묶지 않는다. 너무 긴 값 때문에 업로드가 실패하면 안 된다.
CREATE TABLE merchant_model_decision (
    transaction_id uuid PRIMARY KEY REFERENCES transaction(id) ON DELETE CASCADE,
    -- top-1. 거절했으면 NULL
    category text,
    -- confidence·known 은 화면에 쓰지 않는다. 자동 확정 기준을 실데이터로 다시 잴 때 본다(docs/category_decision_eval.md)
    confidence double precision,
    known double precision,
    -- 모델이 준 후보 그대로. 화면에 보일 때 허용 어휘로 거른다
    suggestions jsonb NOT NULL DEFAULT '[]',
    refused boolean NOT NULL DEFAULT false,
    model text NOT NULL,
    created_at timestamptz NOT NULL
);
