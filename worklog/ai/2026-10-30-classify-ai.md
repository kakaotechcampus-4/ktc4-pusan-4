# 가맹점 업종 AI 분류 — AI 서버 내부 API POST /classify/merchants

- 브랜치: feature/classify-ai
- 커밋: 3b9feac..a86f9f1 (2개)
- 주요파일: ai/classify/decisions.py, ai/classify/choices.json, ai/app/main.py, ai/app/config.py

## 한 일

- 규칙 분류기(PG 차단 → 개인 사전 → 전역 사전 → 키워드)가 못 정한 가맹점을 GPT-6 Luna `/v1/decisions` 에 묻는
  내부 API `POST /classify/merchants` 를 만들었다 (3b9feac)
  - 요청 `{"items": [{"merchantNorm", "merchantRaw"}]}` 1~200건, 문자열은 200자까지. 넘으면 422
  - 응답 `{"model", "results": [...]}` 는 요청 순서다. 항목마다 `category` · `confidence` · `known` · 상위 3개 `suggestions` · `refused`
  - 실패했거나 마감을 넘긴 항목은 `null` 이다. 키나 주소가 없으면 503 `CLASSIFY_UNAVAILABLE`
- 질문은 실험(PR1)에서 고정한 `ai/classify/choices.json` 을 그대로 쓴다. 보기 30개는 카테고리에서 `PG_미상` · `기타` 를 뺀 것이다
- 호출은 모듈 공용 스레드 풀(동시 8)에서 가맹점마다 한 번씩 보낸다. 호출 타임아웃 4초, 요청 전체 마감 8초, 재시도 없음
- 요청마다 로그 한 줄(items · ok · refused · failed · timed_out · elapsed_ms)을 `uvicorn.error` 로거에 남긴다. 가맹점 이름은 남기지 않는다
- 답의 업종이나 상위 3개가 보기 밖이면 그 항목을 실패(`null`)로 본다
- 설정 `classify_*` 6개를 `AGENT_*` · `ASSISTANT_*` 와 따로 두고, Dockerfile 에 `COPY classify ./classify` 를 더했다 (3b9feac)
- `CLASSIFY_API_KEY` · `CLASSIFY_BASE_URL` · `CLASSIFY_MODEL` 을 compose 와 env 예시 두 곳에 더했다 (a86f9f1)

## 왜 이렇게 했나

- 여러 가맹점을 한 요청에 묶으면 답의 25% 가 바뀌어 실험에서 잰 임계값이 맞지 않는다. 그래서 하나씩 보낸다
- AI 서버는 숫자만 돌려준다. 확정할지는 백엔드(PR3)가 업로드 트랜잭션 전에 이 API 를 부르고 임계값으로 정한다
- 앱 로거는 루트 기본값(WARNING)이라 info 가 버려진다. uvicorn 이 INFO 핸들러를 달아 둔 `uvicorn.error` 를 쓴다
- 게이트웨이 env 값이 `/v1` 로 끝나서 끝의 `/` 와 `/v1` 을 떼고 `/v1/decisions` 를 붙인다
- 연결을 재사용하려고 `httpx.post` 대신 공용 `httpx.Client` 를 쓴다. 테스트도 이 클라이언트를 가짜 전송으로 바꿔 끼운다

## 확인한 것

- 새 테스트 19건(본문 모양, 보기 = 카테고리 − PG_미상 · 기타, 파싱 3종과 보기 밖 업종, 주소 4종, 가짜 전송으로 Bearer · 주소 · HTTP 오류, 순서, 마감 초과 `null` 과 로그, 503, 422 4종)
- ai pytest 231건, ruff check 통과. 실제 모델 API 는 부르지 않았다

## 남은 것 · 아는 문제

- 동시 8 · 마감 8초라 한 요청에서 받는 건수는 호출 지연에 달렸다(지연 1초면 약 64건, 나머지는 `null`). 운영 지연을 재고 값을 정한다
- 풀이 프로세스 공용이라 요청이 겹치면 뒤 요청은 앞 요청 뒤에 줄을 선다. 마감을 넘긴 대기 항목은 취소된다
- `docs/` 에 이 내부 API 계약은 아직 없다. PR3(백엔드)와 같이 적는다
- `ruff format --check` 는 새 파일과 기존 `main.py` · `config.py` 를 다시 감싸라고 한다. 기존 코드도 포맷을 따르지 않아 맞추지 않았다
