#!/usr/bin/env bash
set -euo pipefail

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

key="postgres/$(date -u +%Y/%m/%d/%H%M%S).dump"
docker compose --env-file "$config" -f "$repo/deploy/compose.yaml" \
    exec -T postgres pg_dump -Fc -U "$DB_USERNAME" "$DB_NAME" \
    | aws s3 cp - "s3://$BACKUP_BUCKET/$key" --region ap-northeast-2 --sse AES256

echo "Backup uploaded: s3://$BACKUP_BUCKET/$key"
