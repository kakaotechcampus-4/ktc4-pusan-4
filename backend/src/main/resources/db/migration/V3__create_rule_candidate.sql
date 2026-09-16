CREATE TABLE rule_candidate (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    merchant_category varchar(50) NOT NULL,
    industry_code varchar(6) NOT NULL,
    distinct_users integer NOT NULL CHECK (distinct_users >= 0),
    occurrence_count integer NOT NULL CHECK (occurrence_count >= 0),
    suggested_docs jsonb NOT NULL DEFAULT '[]'::jsonb,
    searched_tier varchar(30),
    draft_yaml text,
    status varchar(20) NOT NULL DEFAULT '대기'
        CHECK (status IN ('대기', '검토중', '승인', '기각', '보류')),
    reviewed_by varchar(100),
    reviewed_at timestamptz,
    pr_url text,
    promoted_rule_id varchar(30),
    created_at timestamptz NOT NULL DEFAULT now()
);
