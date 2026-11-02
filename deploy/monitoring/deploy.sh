#!/usr/bin/env bash
# 모니터링 스택(deploy/monitoring/template.yaml)을 서울 리전에 배포한다.
# SSO 로그인한 터미널에서 손으로 실행한다. docs/deployment.md 의 "모니터링" 절 참고.
#
#   ARTIFACT_BUCKET=<Lambda zip 을 올릴 S3 버킷> \
#   EC2_INSTANCE_ID=i-... \
#   ALARM_DISCORD_WEBHOOK='https://discord.com/api/webhooks/...?thread_id=...' \
#   AWS_PROFILE=ktc-team deploy/monitoring/deploy.sh
#
# 웹훅은 셸 기록에 남지 않게 read -rs 로 받아 export 해도 된다.
set -euo pipefail

: "${ARTIFACT_BUCKET:?Lambda 코드를 올릴 S3 버킷 이름}"
: "${EC2_INSTANCE_ID:?운영 EC2 인스턴스 ID}"
: "${ALARM_DISCORD_WEBHOOK:?장애 알림 스레드 웹훅 URL}"

REGION=ap-northeast-2   # 조직 SCP 가 서울 밖을 막는다
STACK=ktc4-monitoring
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/ktc4-monitoring.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
PACKAGED="$WORK/packaged.yaml"

# 템플릿의 Code: alarm_to_discord.zip 은 템플릿 옆 파일을 가리킨다. 작업 폴더에 둘을 같이 둔다.
cp "$HERE/template.yaml" "$WORK/template.yaml"
(cd "$HERE" && zip -q -X "$WORK/alarm_to_discord.zip" alarm_to_discord.py)

aws cloudformation package \
  --region "$REGION" \
  --template-file "$WORK/template.yaml" \
  --s3-bucket "$ARTIFACT_BUCKET" \
  --s3-prefix monitoring \
  --output-template-file "$PACKAGED"

aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK" \
  --template-file "$PACKAGED" \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    "InstanceId=$EC2_INSTANCE_ID" \
    "DiscordWebhookUrl=$ALARM_DISCORD_WEBHOOK"

aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query 'Stacks[0].Outputs' --output table
