# 에이전트 비서 Really — AI 서버 구현

- 브랜치: feature/agent-secretary
- 커밋: e69a67d..fae3a9d (11개)
- 주요파일: ai/assistant/tools.py, ai/assistant/agent.py, ai/app/main.py, docs/agent-secretary.md

## 한 일

- 명세 `docs/agent-secretary.md`를 추가했다. 보고서 생성을 없앤 결정을 CONTEXT.md · architecture.md · backend_api_plan.md에 반영했다.
  명세에 AI 서버 API 계약(9장)과 BE·FE 요구(10장)를 넣었다 (e69a67d)
- `ai/assistant/` 패키지를 만들었다
  - `backend.py`: 사용자 토큰을 그대로 넘기는 urllib 조회 클라이언트 (23856e8)
  - `tools.py`: 도구 13개. 조회 7개(f484488)와 제안 6개 · 화면별 묶음(38fab90). UUID는 턴 단위 별칭(g1 · t1 · c1)으로 바꾸고, 응답은 필드를 골라 넘긴다
  - `validate.py`: 최종 답 검증기. 숫자 · 조문 · 말투 · 금칙어를 본다 (53f00b9)
  - `agent.py`: 도구 호출 루프. LLM 호출 8회 · 도구 라운드 5회 · 30초 상한, 검증에 걸리면 3회까지 다시 쓰게 하고 그래도 안 되면 폴백 문구 (a0eb541)
- `POST /assistant/chat`(내부 전용)을 붙였다. pydantic 검증, 동시 실행 8턴(넘으면 429) (4248324)
- Dockerfile에 `COPY assistant`를 넣었다. compose 두 곳과 env 예시에 `ASSISTANT_*`를 넘긴다 (b9bca7e)
- `pipeline/llm.py`의 Langfuse 초기화에 마스킹을 붙였다. 이메일 · 전화번호 · 주민등록번호 · 카드번호를 가리고, 규칙 후보 파이프라인 추적에도 적용된다 (42d155a)
- 평가 하네스를 추가했다: `eval/run_assistant.py`, 시나리오 28개(`eval/assistant_cases.yaml`), 가짜 백엔드(`eval/assistant_fake.py`). CI에는 넣지 않았다 (4c2b224)

검증:
- ai pytest 199건, ruff 통과
- `docker build ai` 후 이미지 안에서 비서 모듈 import 확인
- Luna 평가(시나리오 28개 × 3회): 84/84, 턴 중앙값 4.8초 · 최대 8.5초
- API 스모크: 백엔드 없이 실제 Luna로 호출했다. 200 응답에 안내 답이 왔고, Langfuse에 에이전트 → LLM → 도구(WARNING) → LLM 트리가 남았다

## 왜 이렇게 했나

- LangChain 없이 루프를 직접 짰다. 근거는 명세 7장
- `llm.client()`는 쓰지 않았다. 설정이 없으면 SystemExit이고 재시도가 5회 · 60초라 대화에 맞지 않는다. `structured()`의 게이트웨이 규칙 3줄은 리팩터링하지 않고 비서 쪽에 복사했다
- 평가에서 찾은 문제 세 가지를 고쳤다 (fae3a9d)
  - 일괄 답이 거절되자 모델이 "남은 질문 전부 개인"이라는 말로 개별 답 카드를 여러 장 만들었다(S19). 그래서 `user_said` 근거는 인용 문장이 그 대상(가맹점 이름이나 날짜 · 금액)을 가리킬 때만 받는다. 답 · 분류 · 판정 수정에 적용했다
  - 타임아웃 뒤 SDK 재시도로 한 턴이 66초 걸렸다. `max_retries=0`으로 바꿨다
  - 판정을 바꿔 달라는 요청을 모델이 세무대리인 질문으로 돌렸다(S22). 프롬프트를 고쳤다
- 일괄 답 규칙은 질문 화면(FE)과 같게 맞췄다. 남은 그룹이 5개 이하여야 하고, 소명 대기가 섞인 종류는 거절한다

## 남은 것 · 아는 문제

- BE에 `/progress`와 `/questions/suggestions`가 아직 없다. get_status는 오류로 답하고 지난번 답은 쓸 수 없다. 실제 백엔드에 붙여서는 돌려 보지 않았다
- BE 중계 API, 세무대리인 질문 저장 API, FE 패널과 제안 카드가 필요하다. 요청 목록은 명세 10장에 있다
- 로컬과 배포 env에 `ASSISTANT_*` 4개를 넣어야 비서가 모델을 부른다. 없으면 폴백 문구로만 답한다
- 숫자 검증은 한글 숫자("4만 원")를 잡지 못한다. 대상 검사는 줄임말("한전")을 알아보지 못한다
- 동시 실행 한도는 프로세스 단위다. 거래 조회는 1,000건까지만 센다
- Langfuse 보관 기간은 콘솔 설정이라 코드로 정하지 않았다
