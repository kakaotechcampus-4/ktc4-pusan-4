#!/usr/bin/env bash
# 운영 EC2 에 CloudWatch Agent 를 설치(또는 설정만 갱신)한다. 여러 번 돌려도 된다.
#   sudo bash /opt/ktc4/repo/deploy/cloudwatch-agent/install.sh
# 자격 증명은 인스턴스 역할 ktc-ec2-ssm-role 의 CloudWatchAgentServerPolicy 를 쓴다.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
AGENT=/opt/aws/amazon-cloudwatch-agent

if [ ! -x "$AGENT/bin/amazon-cloudwatch-agent-ctl" ]; then
  arch="$(dpkg --print-architecture)"   # amd64 또는 arm64
  deb="$(mktemp --suffix=.deb)"
  trap 'rm -f "$deb"' EXIT
  curl -fsSL -o "$deb" "https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/${arch}/latest/amazon-cloudwatch-agent.deb"
  dpkg -i -E "$deb"
fi

install -m 0644 "$HERE/prometheus.yaml" "$AGENT/etc/prometheus.yaml"
"$AGENT/bin/amazon-cloudwatch-agent-ctl" -a fetch-config -m ec2 -s -c "file:$HERE/config.json"
"$AGENT/bin/amazon-cloudwatch-agent-ctl" -a status
