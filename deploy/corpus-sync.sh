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

# 영향 카드를 찾으려고 배포된 커밋의 rules/ 를 읽기 전용으로 붙인다
run=(docker compose --env-file "$config" -f "$repo/deploy/compose.yaml" run --rm --no-deps -T
    -v "$repo/rules:/rules:ro" ai)
since=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# 판례(prec)는 코퍼스에 아직 넣지 않았다. 한 대상이 실패해도 나머지와 재색인·알림은 돌린다
failed=()
for target in law admrul expc decc; do
    "${run[@]}" python -m pipeline.law_sync --target "$target" --resume || failed+=("$target")
done
"${run[@]}" python -m pipeline.reindex --incremental || failed+=(reindex)
"${run[@]}" python -m pipeline.sync_report --since "$since" --failed "${failed[*]}" || failed+=(report)
[[ ${#failed[@]} -eq 0 ]]
