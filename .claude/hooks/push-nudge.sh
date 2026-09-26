#!/bin/sh
# pre-push 훅이 worklog 없다고 push 를 막으면, Claude 에게 스킬을 돌리라고 알린다.
# PostToolUse(Bash) 로 붙는다. stdin 은 도구 호출과 결과가 통째로 담긴 JSON 이다.

s=$(cat)
printf '%s' "$s" | grep -q 'git push' || exit 0
printf '%s' "$s" | grep -q 'worklog 문서가 없습니다' || exit 0

echo 'worklog 문서가 없어 pre-push 훅이 push 를 막았다. worklog 스킬을 실행해 이번 push 분량의 문서를 만들고 커밋한 뒤, 막혔던 push 명령을 그대로 다시 실행하라.' >&2
exit 2
