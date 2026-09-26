# push 단위 작업 로그 체계 도입

- 브랜치: feature/make-worklog
- 커밋: 38e91ac 이후 5개
- 주요파일: `.githooks/pre-push`, `.claude/skills/worklog/SKILL.md`, `.claude/settings.json`, `CLAUDE.md`

## 한 일

- `worklog/` 신설. `fe`/`be`/`ai`/`etc` 도메인별로 `YYYY-MM-DD-<슬러그>.md` 를 쌓는다.
- `.githooks/pre-push` — push 범위에 `worklog/` 밖 변경이 있는데 `worklog/` 변경이
  없으면 push 를 막는다. 브랜치 삭제와 태그 push 는 검사하지 않는다.
- `.claude/skills/worklog/SKILL.md` — `/worklog` 로 문서를 만들고 커밋한다. 훅에 막혀서
  실행된 경우에는 막혔던 push 를 이어서 한다. 사용자가 미는 push 는 한 번이면 된다.
- `.claude/settings.json` — SessionStart 훅이 `core.hooksPath` 를 자동으로 건다.
  팀원이 수동으로 설정할 게 없다.
- `.claude/hooks/push-nudge.sh` — PostToolUse(Bash) 훅. 게이트에 막힌 push 를 감지하면
  Claude 에게 worklog 스킬을 돌리고 push 를 다시 하라는 지시를 주입한다. 훅은 스킬을
  직접 호출할 수 없어서, stderr 를 읽고 알아서 판단하길 기대하는 대신 지시를 꽂는다.
- 안 쓰는 워크트리(`.claude/worktrees/eval-set`)를 지웠다. 원격에 다 올라가 있고
  미커밋 변경이 없어서 잃은 것은 없다. 덕분에 `.gitignore` 는
  `.claude/settings.local.json` 과 `.claude/worktrees/` 두 줄로 끝난다.
- `.gitattributes` 에 `.githooks/* text eol=lf`. CRLF 로 체크아웃되면
  Windows 에서 훅이 `bad interpreter` 로 죽는다. `backend/gradlew` 와 같은 처리다.
- `CLAUDE.md` 6절 — `docs/`(현재 스펙)와 `worklog/`(기록)의 구분, 그리고 작업 전에
  해당 도메인 worklog 최신 2개를 읽는 규칙.

## 왜 이렇게 했나

- 훅이 문서를 만들어 다시 push 하는 방식은 버렸다. pre-push 시점엔 밀 ref 가 이미
  확정돼서 훅 안에서 만든 커밋은 이번 push 에 안 실리고, 훅 안에서 다시 push 하면
  재귀다. 그래서 훅은 **막기만** 하고 문서 생성은 스킬이 먼저 한다.
- Claude Code 쪽 PreToolUse 게이트는 두지 않았다. git 훅이 모든 경로의 push 를
  막으므로 Claude 가 미는 push 도 같이 막힌다. 두 겹을 유지할 이유가 없다.
- 브랜치 이름으로 대상을 거르지 않는다. PR 플로우라 develop 머지는 push 가 아니라
  GitHub 에서 일어나고, 실제 발화 지점은 피처 브랜치 push 다.

## 남은 것 · 아는 문제

- `--no-verify` 로 우회 가능하다. 로컬 훅의 한계고, 막으려면 CI 가 필요한데
  `.github/workflows/` 는 운영이 덮어쓴다.
- `feature/rag-architecture` 의 6e3748b 가 `.claude/` 를 통째로 무시한다. develop 에
  머지될 때 그 줄이 남으면 앞으로 추가할 스킬 파일이 조용히 무시된다. 머지 시 지워야 한다.
