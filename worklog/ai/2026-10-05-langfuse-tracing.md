# LLM 호출을 Langfuse Cloud(Japan)로 추적

- 브랜치: feature/langfuse
- 커밋: 841a5fe..8cda347 (4개)
- 주요파일: ai/pipeline/llm.py, ai/pipeline/candidates.py, ai/app/config.py, deploy/compose.yaml

## 한 일

- `langfuse>=4.16` 의존성을 추가했다 (841a5fe)
- `llm.py` 의 `OpenAI` 를 `langfuse.openai` 것으로 바꿨다. `structured()` 호출이 모델·토큰·비용·지연·입출력과
  함께 기록된다 (a3249c9)
  - Langfuse 클라이언트는 모듈 import 때 settings 의 키로 만든다. 키가 비면 `tracing_enabled=False` 로 끈다
  - `langfuse_base_url` 기본값은 `https://jp.cloud.langfuse.com` 이다
  - `.env.example` · `deploy/production.env.example` · `compose.yaml` · `deploy/compose.yaml` 에
    `LANGFUSE_PUBLIC_KEY` · `LANGFUSE_SECRET_KEY` 를 넣었다
- `candidates.propose()` 에 `@observe()` 를 붙였다. 후보 1건의 rewrite · 검색 임베딩 · select · draft 가
  한 trace 로 묶인다 (486ee76)
- `structured()` 가 `name=schema.__name__` 을 넘긴다. 단계가 `SearchPlan` · `Evidence` · `RuleCardDraft` 로
  구분된다 (8cda347)

확인(로컬 DB, 카페/940909 1건, DB 는 롤백):
- trace 1개 = `propose` 아래 SearchPlan 988토큰 · 임베딩 32 · Evidence 14,471 · RuleCardDraft 985, 12.5초
- 키 변수가 없을 때와 빈 문자열일 때 모두 호출이 정상이다
- ruff · pytest 109 통과

## 왜 이렇게 했나

- Cloud 로 갔다(사용자 결정). v3 셀프호스팅은 ClickHouse · Redis · S3 가 필요해 운영 EC2(ai 512MB)에 무겁다
- 리전은 Japan 이다. 운영 EC2 가 서울(ap-northeast-2)이라 가장 가깝고, 리전 사이 이전은 안 된다
- 주소를 config 기본값으로 둔 이유
  - SDK 기본값이 EU 라 빠뜨리면 인증이 실패한다
  - compose 로 넘길 변수가 하나 준다
- 클라이언트를 `client()` 가 아니라 import 때 만드는 이유
  - `@observe` 가 `rewrite` 보다 먼저 돈다. 그때 클라이언트가 없으면 SDK 가 `os.environ` 에서 키를 찾는다
  - pydantic-settings 는 `.env` 를 `os.environ` 에 넣지 않아서 로컬에서 빈 trace 가 된다
- `tracing_enabled` 를 명시한 이유: compose 는 빈 변수를 `""` 로 넘기는데 SDK 는 `None` 일 때만 끈다
- `flush()` 는 넣지 않았다. SDK 가 atexit 에서 shutdown 하며 보낸다. 배치 종료 뒤 trace 가 들어온 것으로 확인했다
- `embed.py` 는 감싸지 않았다
  - `langfuse.openai` 는 import 만으로 openai 를 전역 패치한다. `llm` 을 import 한 프로세스는 임베딩도 기록된다
  - `reindex` 는 `llm` 을 import 하지 않는다. 재색인 임베딩 수천 건이 Hobby 한도(월 50k units)를 먹지 않는다

## 남은 것 · 아는 문제

- `eval/run_draft.py` 의 `@observe` 는 PR #81(같은 파일 수정 중) 머지 뒤로 미뤘다. 그전엔 하네스 호출이 하나씩 따로 남는다
- 운영 `/etc/ktc4/production.env` 에 키를 넣었다. 이 브랜치가 배포돼야 `deploy/compose.yaml` 이 ai 컨테이너에 넘긴다
- 키 변수가 아예 없으면 SDK 가 호출마다 `Authentication error ... Client will be disabled` 경고를 찍는다. 동작은 정상이다
- 9/16 이후 만든 Langfuse 조직은 옛 조회 API(`GET /api/public/traces/...`)가 410 이다. 스크립트로 읽을 땐
  `observations.get_many(fields=...)` 를 쓴다
- 후보 1건이 약 5 units 다

## 15:59 PR #83 리뷰 반영 — 키 없을 때 경고 끄기, reindex 에 llm import 금지

- 커밋: 30ec5b3 (1개)
- 키가 없으면 langfuse 로거를 ERROR 로 올린다. 앞 절 "남은 것" 의 호출마다 찍히던
  `Authentication error ... Client will be disabled` 경고가 사라진다. 키가 있을 때는 그대로다
- `reindex.py` 의 import 자리에 `pipeline.llm` 을 import 하지 말라고 적었다

왜:
- 리뷰 2·3번 요청이다. 경고가 호출마다 찍히면 진짜 에러가 묻힌다
- 로거 수준은 `Langfuse(...)` 생성 전에 올린다. 생성자가 찍는 첫 경고도 막아야 한다

확인: 키 변수가 없을 때 · 빈 문자열일 때 모두 경고 없이 호출 정상, ruff · pytest 109 통과

남은 것:
- 리뷰 추가 항목: trace 입출력 원문이 Langfuse Cloud 로 나간다. 지금 규칙 후보는 업종 정보뿐이다. 판정처럼
  사용자 거래가 들어가는 곳에 붙일 때는 카드 내역이 나가지 않게 따로 본다(SDK `mask` 옵션이 후보)

## 16:48 PR #81 머지 뒤 RAG 하네스(run_draft)도 trace 로 묶기

- 커밋: f764abd(develop 병합), 9be968d
- develop 을 병합했다. #81 의 `run_draft.py` · `select.py` 변경이 들어왔고 충돌은 없었다
- `run_draft.produce()` 에 `@observe()` 를 붙였다. 키 1개의 SearchPlan · 임베딩 · Evidence · RuleCardDraft 가
  한 trace 로 묶인다. 전엔 32키 한 번에 trace 가 100개 남짓 흩어졌다

왜:
- 앞 절 "남은 것" 첫 항목이다. #81 이 같은 파일을 고치고 있어서 미뤘다
- 입력 캡처는 기본값 그대로 둔다. 인자 중 가장 큰 `plans`(.plans.json)가 32키 8KB 라 부담이 없고, 입력에
  카테고리 · 업종이 남아 어느 키의 trace 인지 바로 보인다

확인: 카페/940909 1키(plan 캐시는 임시 경로) → `produce` 아래 4개, 13.4초. ruff · pytest 114 통과

## 16:56 CONTEXT.md §6 — 위임 고시는 구속력이 있다고 바로잡음

- 브랜치: docs/context-notice-binding
- 커밋: 08b957d (1개)
- §6 "근거 위계" 의 "기본통칙·고시·예규 → 참고 해석기준(법적 구속력 없음)" 을 둘로 나눴다
  - 기본통칙·예규: 그대로 국세청 내부 해석기준, 구속력 없음
  - 고시: 법령의 위임을 받은 고시는 법령을 보충해 대외적 구속력이 있다. 화면에서 고시에는 "구속력 없음"을
    붙이지 않고, 규칙 후보는 고시만으로 확정 결론을 세울 수 있다(`select.py` 의 `LOWER`)
  - 화면 라벨("참고 해석기준")과 위계 순서는 그대로 뒀다

왜:
- PR #90(FE 판정 결과) 리뷰 요청이다. FE 는 §6 대로 고시를 참고 해석기준으로 뒀는데 `select.py` 는 위임 고시를
  확정 근거로 쓴다. 리뷰어가 둘 중 맞지 않는 쪽을 고치라고 했다
- 틀린 쪽은 §6 이다. 지금 카드가 인용하는 고시는 R-070 의 `업무용승용차운행기록방법에관한고시`(#2104628) 하나이고,
  위임을 받은 고시다
- FE 는 이미 고시에 "구속력 없음"을 붙이지 않아 고칠 게 없다. `hierarchy` 에 위임 여부가 없어 고시끼리는 가를 수
  없으니 라벨은 그대로 둔다

남은 것:
- `select.py` 의 `_TIER_NOTE["행정규칙"]` 이 프롬프트에 "국세청 내부 해석기준. 법적 구속력은 없다" 를 넣는다.
  고시도 이 tier 라 같은 문제가 있다. 프롬프트를 바꾸면 RAG 수치가 움직여서 이번엔 손대지 않았다
- `LOWER` 의 기준(위임 없으면 하위)대로면 예규·기본통칙도 하위인데 빠져 있다. 팀 결정이 필요하다
