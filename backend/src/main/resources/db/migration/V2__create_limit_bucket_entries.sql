CREATE TABLE limit_bucket_entry (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES app_user(id),
    tax_year integer NOT NULL CHECK (tax_year >= 2000),
    bucket_code varchar(50) NOT NULL,
    judgment_id uuid NOT NULL REFERENCES judgment(id) ON DELETE CASCADE,
    tagged_amount bigint NOT NULL CHECK (tagged_amount >= 0),
    allowed_amount bigint NOT NULL CHECK (allowed_amount >= 0),
    state varchar(20) NOT NULL CHECK (state IN ('잠정', '확정')),
    CHECK (allowed_amount <= tagged_amount),
    UNIQUE (user_id, tax_year, bucket_code, judgment_id)
);

CREATE INDEX idx_limit_bucket_entry_scope
    ON limit_bucket_entry(user_id, tax_year, bucket_code, state);
