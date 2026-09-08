CREATE TABLE app_user (
    id uuid PRIMARY KEY,
    email varchar(320) NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_context (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES app_user(id),
    industry_code varchar(6) NOT NULL,
    prev_year_revenue bigint NOT NULL CHECK (prev_year_revenue >= 0),
    business_open_date date NOT NULL,
    bookkeeping_duty varchar(20) NOT NULL
        CHECK (bookkeeping_duty IN ('복식부기', '간편장부', '추계')),
    has_employee boolean NOT NULL,
    home_office_ratio integer CHECK (home_office_ratio BETWEEN 0 AND 100),
    version integer NOT NULL CHECK (version > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, version)
);

CREATE TABLE upload_batch (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES app_user(id),
    source_type varchar(20) NOT NULL
        CHECK (source_type IN ('승인내역', '청구내역', '판별불가')),
    card_issuer varchar(20) NOT NULL CHECK (card_issuer IN ('국민', '기업')),
    period_start date NOT NULL,
    period_end date NOT NULL,
    file_hash varchar(128) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (period_end >= period_start),
    UNIQUE (user_id, file_hash)
);

CREATE TABLE transaction (
    id uuid PRIMARY KEY,
    batch_id uuid NOT NULL REFERENCES upload_batch(id) ON DELETE CASCADE,
    approved_at date NOT NULL,
    merchant_raw text NOT NULL,
    merchant_norm text NOT NULL,
    merchant_category varchar(50) NOT NULL,
    amount bigint NOT NULL,
    installment_months integer NOT NULL DEFAULT 1 CHECK (installment_months > 0),
    natural_key varchar(128) NOT NULL,
    status varchar(20) NOT NULL
        CHECK (status IN ('판정대상', '취소상계', '대상제외')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (natural_key)
);

CREATE INDEX idx_transaction_batch_approved_at
    ON transaction(batch_id, approved_at, id);

CREATE TABLE statute_version (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    statute_id varchar(100) NOT NULL,
    doc_type varchar(30) NOT NULL,
    hierarchy varchar(30) NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    issued_at date,
    is_superseded boolean NOT NULL DEFAULT false,
    body text NOT NULL,
    body_hash varchar(128) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (effective_to IS NULL OR effective_to > effective_from),
    UNIQUE (statute_id, effective_from)
);

CREATE FUNCTION protect_statute_version_content()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id
        OR NEW.statute_id IS DISTINCT FROM OLD.statute_id
        OR NEW.doc_type IS DISTINCT FROM OLD.doc_type
        OR NEW.hierarchy IS DISTINCT FROM OLD.hierarchy
        OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
        OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
        OR NEW.body IS DISTINCT FROM OLD.body
        OR NEW.body_hash IS DISTINCT FROM OLD.body_hash
        OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'statute_version content is append-only';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_statute_version_append_only
BEFORE UPDATE ON statute_version
FOR EACH ROW EXECUTE FUNCTION protect_statute_version_content();

CREATE TABLE judgment (
    id uuid PRIMARY KEY,
    transaction_id uuid NOT NULL REFERENCES transaction(id),
    revision integer NOT NULL CHECK (revision > 0),
    rule_card_id varchar(30),
    rule_card_version integer,
    rules_commit_sha varchar(64) NOT NULL,
    user_context_version integer NOT NULL,
    tax_year integer NOT NULL CHECK (tax_year >= 2000),
    verdict varchar(30) NOT NULL
        CHECK (verdict IN ('AVAILABLE', 'UNAVAILABLE', 'NEEDS_REVIEW')),
    blocked_at_gate varchar(2)
        CHECK (blocked_at_gate IN ('G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6')),
    is_inference boolean NOT NULL,
    unmatched_reason varchar(30)
        CHECK (unmatched_reason IN ('RULE_NOT_FOUND', 'UNCLASSIFIED', 'PROFILE_MISSING', 'CONDITION_MISMATCH')),
    account varchar(100),
    attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
    applied_rule_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    input_facts jsonb NOT NULL DEFAULT '[]'::jsonb,
    final_amount bigint,
    state varchar(20) NOT NULL DEFAULT '잠정' CHECK (state IN ('잠정', '확정')),
    computed_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (transaction_id, revision),
    CHECK ((is_inference AND unmatched_reason IS NOT NULL) OR (NOT is_inference))
);

CREATE INDEX idx_judgment_transaction_revision
    ON judgment(transaction_id, revision DESC);

CREATE TABLE judgment_citation (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    judgment_id uuid NOT NULL REFERENCES judgment(id) ON DELETE CASCADE,
    statute_version_id bigint NOT NULL REFERENCES statute_version(id),
    UNIQUE (judgment_id, statute_version_id)
);

CREATE TABLE user_fact (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES app_user(id),
    scope_key text NOT NULL,
    fact_type varchar(50) NOT NULL,
    value jsonb NOT NULL,
    version integer NOT NULL CHECK (version > 0),
    answered_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, scope_key, fact_type, version)
);

CREATE INDEX idx_user_fact_latest
    ON user_fact(user_id, scope_key, fact_type, version DESC);

CREATE TABLE question_queue (
    id uuid PRIMARY KEY,
    judgment_id uuid NOT NULL REFERENCES judgment(id) ON DELETE CASCADE,
    answered_fact_id uuid REFERENCES user_fact(id),
    reason_code varchar(50) NOT NULL,
    question_text text NOT NULL,
    group_key text NOT NULL,
    options jsonb NOT NULL DEFAULT '[]'::jsonb,
    status varchar(20) NOT NULL DEFAULT '대기'
        CHECK (status IN ('대기', '응답', '취소')),
    created_at timestamptz NOT NULL DEFAULT now(),
    answered_at timestamptz,
    CHECK ((status = '응답' AND answered_fact_id IS NOT NULL AND answered_at IS NOT NULL)
        OR status <> '응답')
);

CREATE TABLE unmatched_log (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    judgment_id uuid NOT NULL UNIQUE REFERENCES judgment(id) ON DELETE CASCADE,
    reason varchar(30) NOT NULL
        CHECK (reason IN ('RULE_NOT_FOUND', 'UNCLASSIFIED', 'PROFILE_MISSING', 'CONDITION_MISMATCH')),
    merchant_category varchar(50) NOT NULL,
    merchant_raw text NOT NULL,
    industry_code varchar(6) NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE merchant_dict (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id uuid REFERENCES app_user(id),
    pattern text NOT NULL,
    merchant_norm text NOT NULL,
    merchant_category varchar(50) NOT NULL,
    source varchar(20) NOT NULL CHECK (source IN ('수기', 'override', 'websearch', 'user')),
    resolved_evidence text,
    resolved_at timestamptz NOT NULL DEFAULT now(),
    confidence numeric(5, 4) NOT NULL CHECK (confidence BETWEEN 0 AND 1)
);

CREATE UNIQUE INDEX uq_merchant_dict_global_pattern
    ON merchant_dict(pattern) WHERE user_id IS NULL;

CREATE UNIQUE INDEX uq_merchant_dict_personal_pattern
    ON merchant_dict(user_id, pattern) WHERE user_id IS NOT NULL;

CREATE INDEX idx_merchant_dict_lookup
    ON merchant_dict(pattern, user_id);
