-- 적용: psql "$DATABASE_URL" -f db/schema.sql
-- 로컬/CI는 compose가 20-schema.sql로 마운트해 자동 적용. 확장은 10-extensions.sql이 먼저.

CREATE TABLE IF NOT EXISTS statute_version (
    id              bigserial   PRIMARY KEY,
    statute_id      text        NOT NULL,   -- 소득세법-33-1-2. 버전이 바뀌어도 동일
    doc_type        text        NOT NULL,
    doc_id          text        NOT NULL,
    unit_level      text        NOT NULL,
    hierarchy       text        NOT NULL,
    title           text        NOT NULL,
    doc_no          text,
    effective_from  date        NOT NULL,
    effective_to    date,
    issued_at       date,
    is_superseded   boolean     NOT NULL DEFAULT false,
    body            text        NOT NULL,
    body_hash       text        NOT NULL,
    source_url      text        NOT NULL,
    meta            jsonb       NOT NULL DEFAULT '{}'::jsonb,
    fetched_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT statute_version_period
        CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT statute_version_level
        CHECK (unit_level IN ('조', '항', '호', '문서')),
    CONSTRAINT statute_version_unique
        UNIQUE (statute_id, effective_from)
);

-- append-only 강제: statute_id당 현행(effective_to IS NULL) 행은 최대 1개
CREATE UNIQUE INDEX IF NOT EXISTS statute_version_current_idx
    ON statute_version (statute_id) WHERE effective_to IS NULL;

CREATE INDEX IF NOT EXISTS statute_version_lookup_idx
    ON statute_version (statute_id, effective_from DESC);

CREATE INDEX IF NOT EXISTS statute_version_source_idx
    ON statute_version (doc_type, doc_id);


CREATE TABLE IF NOT EXISTS law_sync_log (
    id               bigserial   PRIMARY KEY,
    ran_at           timestamptz NOT NULL DEFAULT now(),
    target_law       text,
    doc_type         text,
    changed          boolean     NOT NULL DEFAULT false,
    changed_statutes jsonb       NOT NULL DEFAULT '[]'::jsonb,
    reindexed        boolean     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS law_sync_log_ran_at_idx
    ON law_sync_log (ran_at DESC);
