#!/usr/bin/env bash
set -euo pipefail

exec 9>/run/lock/ktc4-deploy.lock
flock 9

repo=/opt/ktc4/repo
config=/etc/ktc4/production.env
sha=$(cat /opt/ktc4/current-sha)

set -a
# shellcheck disable=SC1090
source "$config"
set +a

export IMAGE_TAG=$sha
postgres_tree=$(git -C "$repo" rev-parse "$sha:docker/postgres")
export POSTGRES_TAG=${postgres_tree:0:12}

run=(docker compose --env-file "$config" -f "$repo/deploy/compose.yaml" run --rm --no-deps -T ai)
# 판례(prec)는 코퍼스에 아직 넣지 않았다. 한 대상이 실패해도 나머지와 재색인은 돌린다
status=0
for target in law admrul expc decc; do
    "${run[@]}" python -m pipeline.law_sync --target "$target" --resume || status=1
done
"${run[@]}" python -m pipeline.reindex --incremental || status=1
exit $status
