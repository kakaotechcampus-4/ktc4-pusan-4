# 규칙 후보 — 에이전트가 실패한 조합을 다음 배치에서 다시 시도 (#94)

- 브랜치: feature/rule-candidate-retry
- 커밋: 0fcf616..2a025a7 (2개)
- 주요파일: ai/pipeline/candidates.py, ai/pipeline/select.py, ai/eval/run_draft.py, docs/rag-eval.md

## 한 일

- 인용 대조에서 낫표 · 따옴표(「」『』 " ' “” ‘’) 차이를 봐준다. `_norm` 이 공백과 함께 이 문자들을 지우고 비교한다.
  허용 목록 주석(`select.py`)에 3번 항목으로 적었다 (0fcf616)
- `candidates.propose()` 는 에이전트가 실패하면 행 대신 `None` 을 돌려준다. `main()` 은 그 후보를 적재하지 않고
  `[건너뜀 · 다음 배치에서 다시]` 만 찍는다. 실패한 경우에만 쓰이던 기본값(빈 근거 · 초안 없음 · 보류)은 지웠다 (2a025a7)
- 초안 하네스(`eval/run_draft.py`)도 오류 키를 보류로 세지 않는다. 전체 보류의 분모에는 그대로 넣는다.
  `docs/rag-eval.md` 의 판정 기준 설명을 고치고 10/26 갱신 기록을 남겼다 (2a025a7)

검증:
- 새 테스트 6건(낫표 · 따옴표 5건, 실패 시 적재할 행 없음 1건)이 고치기 전에 실패하는 것을 먼저 확인했다
- ai pytest 205건, ruff 통과
- 실제 DB · 모델로 배치는 돌리지 않았다

## 왜 이렇게 했나

- 빈 보류 행이 있으면 집계의 `NOT EXISTS` 가 그 (카테고리 × 업종)을 건너뛰어 다시 만들지 않았다.
  관리자 화면은 초안 없는 행을 기각만 할 수 있게 하고, 기각된 조합은 배치가 다시 올리지 않는다.
  그래서 "AI 가 실패했다" 와 "사람이 규칙이 아니라고 했다" 가 같은 결과가 됐다
- 행을 남긴 채 재생성(B안)하거나 사유 칼럼을 추가(C안)하는 것보다 적재하지 않는 쪽이 고칠 곳이 적다.
  마이그레이션도 필요 없다. 계속 실패하는 조합은 매주 다시 시도하지만 후보당 LLM 호출 몇 번이다
- 낫표는 법령 · 행정규칙 청크의 34%(7,038/20,984)에 있다. 4o-mini 에서 보험(시행령-55-1-11)이 매번 재시도를 다 썼다.
  Luna 로 바꾼 뒤 측정(rag-eval §15)에서는 오류가 0 이지만, 코드 기본값은 아직 gpt-4o-mini 다.
  참고 조문 API 도 `select` 를 쓴다
- 하네스는 운영과 같은 보류를 재는 게 원칙이라(`hold_reasons` 공유) 같이 맞췄다

## 남은 것 · 아는 문제

- 수동 적재를 이미 했다면 DB 에 남은 빈 보류 행(`draft_yaml IS NULL`)은 한 번 지워야 한다. 그 조합은 아직 막혀 있다
- 관리자 화면 문구("초안을 만들지 못했습니다", `frontend/src/pages/Admin.tsx`)와 목 데이터는 예전 행 때문에 그대로 뒀다
- 보류 사유 칼럼은 없다. 정상 보류(근거 부족 등)의 사유도 콘솔에만 남는다. 필요하면 Flyway 마이그레이션과 BE · FE 수정이 함께 필요하다
- 실패 사유는 배치 로그와 Langfuse 에만 남는다. 배치 트리거(cron)가 아직 없다

## 17:57 PR #175 리뷰 반영 — 실패 요약 로그 · 기본 모델 Luna

- 커밋: 2bcae09..75cbb7d (2개)

한 일:
- 배치 끝에 `실패 N건 (카테고리/업종, ...)` 한 줄을 찍는다. 실패가 없으면 찍지 않는다 (2bcae09)
- 코드 기본값을 `agent_model=openai/gpt-6-luna` · `agent_reasoning_effort=none` 으로 바꿨다.
  `.env.example` · `deploy/production.env.example` · `docs/rag-eval.md` 의 "비우면 gpt-4o-mini" 설명도 고쳤다 (75cbb7d)

검증:
- 배치 요약 줄 테스트 1건 추가, ai pytest 206건 · ruff 통과
- env 없이 `Settings` 를 만들어 `structured()` 가 `model=openai/gpt-6-luna` · `reasoning_effort=none` · `temperature=0` 을 보내는 것을 가짜 API 로 확인했다

왜:
- 실패한 조합은 적재되지 않아 관리자 화면에 안 보인다. 계속 실패하는 걸 알아챌 곳이 배치 로그뿐이다
- 운영 엔드포인트는 10/9 에 Luna 로 바뀌었다. env 가 빠지면 gpt-4o-mini 이름이 Luna 엔드포인트로 가서 400 이 났다
- 모델만 바꾸면 Luna 가 추론을 켜고 temperature=0 을 400 으로 거절한다. 그래서 추론 강도도 같이 기본값으로 뒀다

남은 것:
- 추론을 받지 않는 모델(gpt-4o-mini 등)은 env 만으로 고를 수 없다. 빈 값은 기본값 `none` 으로 읽혀 `reasoning_effort` 가 같이 간다. 쓰려면 `config.py` 를 고친다
- 로컬 `.env` 의 `AGENT_BASE_URL` 이 gpt-4o-mini 엔드포인트이고 `AGENT_MODEL` 줄이 없으면 400 이 난다. Luna 엔드포인트로 바꿔야 한다
