-- 적용: psql "$DATABASE_URL" -f db/schema.sql
-- 로컬/CI는 compose가 20-schema.sql로 마운트해 자동 적용. 확장은 10-extensions.sql이 먼저.
--
-- statute_version 은 여기 없다. judgment_citation.statute_version_id 의 FK 대상이라
-- 백엔드 Flyway 가 V1__create_judgment_core.sql 에서 만든다.
-- 양쪽이 같이 만들면 initdb 가 먼저 돌아 Flyway 가 "이미 존재한다"로 실패하고 앱이 안 뜬다.
--
-- 그래서 이 파일만으로는 코퍼스를 적재할 수 없다. 순서는
--   1) Flyway (백엔드 부팅 또는 V1 수동 적용)  2) 이 파일  3) 적재 또는 덤프 복원

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
