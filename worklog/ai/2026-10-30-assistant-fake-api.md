# 비서 가짜 백엔드를 실제 API 응답 모양에 맞춤 (#185 후속)

- 브랜치: feature/fix-fakeapi
- 커밋: a431f3f (1개)
- 주요파일: ai/eval/assistant_fake.py

## 한 일

- `/progress` 의 `run` 을 `{"status": "SUCCEEDED"}` 에서 `{"id": ..., "status": {"code": "COMPLETED", "label": "완료"}}` 로 바꿨다
- `/questions/suggestions`
  - 한국전력 충돌 항목의 `"value": None` 을 뺐다. 백엔드는 등급에 해당하지 않는 필드를 키째 뺀다(api.md 3.14)
  - 항목마다 `code` 를 넣었다. 값은 `rules/cards` 의 질문 코드다
  - `history` 항목에 `bulk` 를 넣었다
- 머리말의 "아직 백엔드에 없는 API" 줄을 지웠다

검증:
- ai pytest 212건, ruff check 통과
- 모델을 부르는 평가(`eval/run_assistant.py`)는 돌리지 않았다

## 왜 이렇게 했나

- #185 머지로 두 API 가 실제로 생겼다. 가짜 백엔드는 그 전에 agent-secretary.md 10장 요구대로 만든 모양이라, 평가에서 모델이 받는 입력이 운영과 달랐다
- `"value": None` 이 있으면 `value` 키가 없는 실제 응답을 테스트가 거치지 않는다. 지금은 `tools.py` 가 `.get` 으로 읽어 괜찮지만, 누가 `s["value"]` 로 바꿔도 테스트가 잡지 못했다

## 남은 것 · 아는 문제

이슈 범위 밖이라 두었다. 시나리오 데이터를 바꾸는 일이라 평가 결과가 달라질 수 있다.
- `factType` 이 실제 카드와 다르다: 가짜 `공간용도` · `결제기간` · `업무용여부`, 실제 `공간전용여부` · `기간` · `용도`
- 스타벅스(카페) · Adobe 묶음 키가 가짜는 `merchant:`, 실제 카드는 건별(`transaction:`)이다
- C 등급 `reason` 은 백엔드가 두 문구만 낸다. 가짜의 쿠팡 · PG 사유 문구는 실제로 나오지 않는다
- `/progress` 의 `batch.id`, `/questions` 응답의 `code` 가 가짜에 없다
