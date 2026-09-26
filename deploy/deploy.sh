#!/usr/bin/env bash
set -euo pipefail

sha=${1:-}
mode=${2:-}
if [[ ! $sha =~ ^[0-9a-f]{40}$ ]] || [[ -n $mode && $mode != --rollback ]]; then
    echo "usage: deploy.sh <40-character commit SHA> [--rollback]" >&2
    exit 2
fi

exec 9>/run/lock/ktc4-deploy.lock
flock 9

repo=/opt/ktc4/repo
config=/etc/ktc4/production.env
test -f "$config"
test -d "$repo/.git"

if [[ $mode == --rollback ]]; then
    if ! git -C "$repo" cat-file -e "$sha^{commit}" 2>/dev/null; then
        git -C "$repo" fetch --depth 1 origin "$sha"
    fi
else
    git -C "$repo" fetch --depth 1 origin release
    release_sha=$(git -C "$repo" rev-parse FETCH_HEAD)
    if [[ $release_sha != "$sha" ]]; then
        echo "Skipping stale release $sha; release is $release_sha" >&2
        exit 1
    fi
fi

git -C "$repo" checkout --force --detach "$sha"

set -a
# shellcheck disable=SC1090
source "$config"
set +a

export IMAGE_TAG=$sha
postgres_tree=$(git -C "$repo" rev-parse "$sha:docker/postgres")
export POSTGRES_TAG=${postgres_tree:0:12}

registry=${ECR_REPOSITORY%%/*}
aws ecr get-login-password --region ap-northeast-2 \
    | docker login --username AWS --password-stdin "$registry"

compose=(docker compose --env-file "$config" -f "$repo/deploy/compose.yaml")
"${compose[@]}" pull
"${compose[@]}" up -d --wait --remove-orphans

# Flyway must initialize the empty application schema before these SQL files run.
"${compose[@]}" exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U "$DB_USERNAME" -d "$DB_NAME" < "$repo/db/schema.sql"
"${compose[@]}" exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U "$DB_USERNAME" -d "$DB_NAME" < "$repo/db/rag.sql"

printf '%s\n' "$sha" > /opt/ktc4/current-sha
docker image prune -af --filter until=168h
echo "Deployed $sha"
