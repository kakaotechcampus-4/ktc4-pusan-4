# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Project Verification

Before finishing a change, read and follow the verification instructions in the relevant module README or contributing guide. Run the prescribed checks and report anything that could not be verified.

## 6. 문서 — `docs/` 와 `worklog/`

| 경로 | 성격 |
| :--- | :--- |
| `docs/` | 현재 스펙과 구조. 틀리면 고친다. 단일 원본이 여기 있다. |
| `worklog/` | 작업 기록. append-only — 이미 쓴 줄은 고치지 않고 끝에만 덧붙인다. |

`worklog/` 는 `fe`·`be`·`ai`·`etc` 도메인별로 `YYYY-MM-DD-<슬러그>.md` 를 쌓는다.
push 한 번에 기록 한 번이고, 같은 날 같은 도메인이면 기존 문서에 이어 쓴다.
`.githooks/pre-push` 가 이를 강제하고, 문서는 `/worklog` 스킬이 쓴다.

**작업을 시작하기 전에, 건드릴 도메인의 worklog 최신 2개를 읽는다.**
직전에 무엇을 왜 했는지 모르면 이미 내린 결정을 다시 뒤집게 된다.

worklog 는 "그때 이랬다" 는 기록이라 지금도 맞다는 보장이 없다.
현재 사실이 필요하면 `docs/` 와 코드를 본다.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
