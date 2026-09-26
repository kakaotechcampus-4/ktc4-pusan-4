# worklog

작업 기록을 시간순으로 쌓는 곳. **append-only** — 이미 쓴 줄은 고치지 않고 끝에만 덧붙인다.

- push 한 번에 기록 한 번. 같은 날 같은 도메인이면 기존 문서에 이어 쓴다.
  `.githooks/pre-push` 가 이걸 강제한다.
- 문서는 Claude Code 에서 `/worklog` 로 만든다.
- 경로: `worklog/<fe|be|ai|etc>/<YYYY-MM-DD>-<슬러그>.md`

현재 스펙과 구조는 `docs/` 가 원본이다. 여기 문서는 "그때 이랬다" 는 기록이라
지금도 맞는지는 보장하지 않는다.

## 설치

Claude Code 를 켜면 `.claude/settings.json` 의 SessionStart 훅이 자동으로 잡는다.
수동으로 하려면:

```
git config core.hooksPath .githooks
```
