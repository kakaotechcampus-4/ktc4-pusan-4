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

# 후보 배치는 카테고리 성격(docs/categories.md)과 업종 프로파일(profiles/)을 읽는데 ai 이미지에는 없다.
# 이미지 안에서 ROOT 가 / 라서 그 자리에 배포된 커밋의 파일을 읽기 전용으로 붙인다
run=(docker compose --env-file "$config" -f "$repo/deploy/compose.yaml" run --rm --no-deps -T
    -v "$repo/docs:/docs:ro" -v "$repo/profiles:/profiles:ro")
log=$(mktemp)
trap 'rm -f "$log"' EXIT
# 한 단계가 실패해도 나머지와 알림은 돌린다
failed=()
# 토큰은 PR 단계에만 넘긴다. 상시 떠 있는 ai 서버에는 두지 않는다
"${run[@]}" -e RULES_PR_TOKEN ai python -m pipeline.promote | tee -a "$log" || failed+=(promote)
"${run[@]}" ai python -m pipeline.candidates --limit 10 | tee -a "$log" || failed+=(candidates)
"${run[@]}" ai python -m pipeline.notify --failed "${failed[*]}" <"$log" || failed+=(notify)
[[ ${#failed[@]} -eq 0 ]]
