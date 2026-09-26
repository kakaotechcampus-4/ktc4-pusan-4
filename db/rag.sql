-- 적용: psql "$DATABASE_URL" -f db/rag.sql
--
-- schema.sql 과 달리 compose 의 initdb 에 마운트하지 않는다.
-- statute_version 을 FK 로 걸어서, initdb(= Flyway 보다 먼저 돈다) 단계에서는
-- 참조 대상이 아직 없어 CREATE TABLE 이 실패하고 컨테이너가 죽는다.
-- 순서는 1) Flyway  2) db/schema.sql  3) 이 파일  4) 적재·재색인.
--
-- 판정 경로는 이 테이블을 쓰지 않는다(RAG 는 규칙 후보 초안·보고서 생성 전용).
-- 백엔드에 JPA 엔티티가 없으므로 ddl-auto: validate 대상도 아니다.

CREATE TABLE IF NOT EXISTS legal_chunk (
    id                 bigserial    PRIMARY KEY,
    statute_version_id bigint       NOT NULL REFERENCES statute_version(id) ON DELETE CASCADE,
    statute_id         varchar(100) NOT NULL,
    doc_id             varchar(20)  NOT NULL,
    doc_type           varchar(30)  NOT NULL,
    hierarchy          varchar(30)  NOT NULL,
    -- 심판례·해석례 전용. 법령·행정규칙은 NULL.
    -- 검색은 기각된 주장(심판례 '주장'·'처분개요')을 제외한다.
    section            varchar(20),
    -- 임베딩 상한을 넘겨 한 섹션을 쪼갠 경우의 순번
    seq                int          NOT NULL DEFAULT 0,
    effective_from     date         NOT NULL,
    effective_to       date,
    is_superseded      boolean      NOT NULL DEFAULT false,
    body               text         NOT NULL,
    -- statute_version.body_hash 복사본. 증분 재색인은 이 값 비교로 판단한다
    source_hash        varchar(128) NOT NULL,
    embedding          vector(1536) NOT NULL,
    indexed_at         timestamptz  NOT NULL DEFAULT now(),
    -- 법령·행정규칙은 section 이 NULL 이라 기본 UNIQUE 로는 중복이 막히지 않는다
    UNIQUE NULLS NOT DISTINCT (statute_version_id, section, seq)
);

-- 벡터 인덱스는 일부러 만들지 않는다.
--
-- HNSW 는 doc_type 필터를 걸기 전에 후보를 뽑는다. 행정규칙은 전체의 9.7% 뿐이라
-- 최근접 이웃을 아무리 긁어도 그 위계의 진짜 1~5위가 안 나온다. 실측으로
-- hnsw.max_scan_tuples 를 20만까지 올려도 정답이 상위 8 에 안 들어왔고,
-- 정확 스캔은 같은 질의에서 정답을 1·2위로 물어왔다. 속도도 110ms 대 115ms 로 같다.
-- 55,530 행 규모에서는 인덱스가 1GB 중 대부분을 먹으면서 결과만 틀리게 만든다.
--
-- ponytail: 코퍼스가 몇 배로 커지거나 RDS 가 눈에 띄게 느리면 doc_type 별
--           부분 인덱스(WHERE doc_type = '...')로 간다. 위계를 늘 필터로 걸기
--           때문에 그때는 필터 문제 자체가 사라진다.

CREATE INDEX IF NOT EXISTS legal_chunk_body_bigm_idx
    ON legal_chunk USING gin (body gin_bigm_ops);

CREATE INDEX IF NOT EXISTS legal_chunk_filter_idx
    ON legal_chunk (doc_type, section, is_superseded);
