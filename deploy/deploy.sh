#!/usr/bin/env bash
set -euo pipefail

sha=${1:-}
mode=${2:-}
if [[ ! $sha =~ ^[0-9a-f]{40}$ ]] || [[ -n $mode && $mode != --rollback ]]; then
    echo "usage: deploy.sh <40-character commit SHA> [--rollback]" >&2
    exit 2
fi

repo=/opt/ktc4/repo
config=/etc/ktc4/production.env
test -f "$config"
test -d "$repo/.git"

# The copy of this file that SSM starts is the previous deploy's, and bash keeps running it even
# after checkout replaces it. So once the target commit is checked out, hand over to that commit's
# deploy.sh: a change to this file then applies to its own deploy. The new process inherits the
# lock on fd 9 and starts from the deploy below.
if [[ -z ${KTC4_DEPLOY_CHECKED_OUT:-} ]]; then
    exec 9>/run/lock/ktc4-deploy.lock
    flock 9

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
    KTC4_DEPLOY_CHECKED_OUT=1 exec bash "$repo/deploy/deploy.sh" "$@"
fi

set -a
# shellcheck disable=SC1090
source "$config"
set +a

export IMAGE_TAG=$sha
postgres_tree=$(git -C "$repo" rev-parse "$sha:docker/postgres")
export POSTGRES_TAG=${postgres_tree:0:12}

registry=${ECR_REPOSITORY%%/*}
export DOCKER_CONFIG
DOCKER_CONFIG=$(mktemp -d)
trap 'rm -rf "$DOCKER_CONFIG"' EXIT
aws ecr get-login-password --region ap-northeast-2 \
    | docker login --username AWS --password-stdin "$registry"

compose=(docker compose --env-file "$config" -f "$repo/deploy/compose.yaml")

# Blue-green: start the idle colour's backend and ai, send /api/v1 to it, then stop the old pair.
# The file Caddy imports records the colour that serves. The single-pair layout (services
# "backend" and "ai", before blue-green or after a --rollback to it) has no colour, and its
# backend holds host port 8080 like blue, so green goes first then.
upstream=$repo/deploy/caddy/upstream.caddy
active=$(sed -n 's/^reverse_proxy backend-\(blue\|green\):8080$/\1/p' "$upstream" 2>/dev/null || true)
single=$(for service in backend ai; do
    docker ps -aq --filter "label=com.docker.compose.project=ktc4" \
        --filter "label=com.docker.compose.service=$service"
done)
if [[ -z $single && $active == green ]]; then next=blue old=green; else next=green old=blue; fi

"${compose[@]}" pull postgres redis web web-files "backend-$next" "ai-$next"
# Postgres and Redis are recreated here if their definitions changed. Flyway runs while the old
# pair keeps serving, so every migration must also work with the previous release (db/README.md).
"${compose[@]}" up -d --wait "backend-$next" "ai-$next"

# Flyway must initialize the empty application schema before these SQL files run.
"${compose[@]}" exec -T postgres \
    psql -1 -v ON_ERROR_STOP=1 -U "$DB_USERNAME" -d "$DB_NAME" < "$repo/db/schema.sql"
"${compose[@]}" exec -T postgres \
    psql -1 -v ON_ERROR_STOP=1 -U "$DB_USERNAME" -d "$DB_NAME" < "$repo/db/rag.sql"

printf 'reverse_proxy backend-%s:8080\n' "$next" > "$upstream"
# Recreates Caddy only when its own definition changed (a version bump); otherwise a no-op.
"${compose[@]}" up -d --no-deps web
"${compose[@]}" exec -T web caddy reload --config /etc/caddy/Caddyfile
"${compose[@]}" run --rm --no-deps web-files

# Traffic has moved, so the old pair finishes its requests and judgment runs (stop_grace_period)
# unseen. It stays stopped rather than removed. Stopping the other colour even when it did not
# serve also cleans up after a deploy that failed before switching.
"${compose[@]}" stop "backend-$old" "ai-$old"
# Retire the single-pair containers the same way.
if [[ -n $single ]]; then
    # shellcheck disable=SC2086 # one container ID per line
    docker stop $single && docker rm $single
fi

printf '%s\n' "$sha" > /opt/ktc4/current-sha
docker image prune -af --filter until=168h
echo "Deployed $sha"
