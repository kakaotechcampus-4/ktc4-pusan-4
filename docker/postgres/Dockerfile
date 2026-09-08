FROM pgvector/pgvector:pg17

ARG PG_BIGM_VERSION=1.2-20250903

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential postgresql-server-dev-17 curl ca-certificates \
  && curl -fsSL  "https://github.com/pgbigm/pg_bigm/archive/refs/tags/v${PG_BIGM_VERSION}.tar.gz" \
    | tar -xz -C /tmp \
 && make -C "/tmp/pg_bigm-${PG_BIGM_VERSION}" USE_PGXS=1 install \
 && rm -rf "/tmp/pg_bigm-${PG_BIGM_VERSION}" /var/lib/apt/lists/*