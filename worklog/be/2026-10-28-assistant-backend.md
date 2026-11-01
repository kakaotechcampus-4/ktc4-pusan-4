# 비서(#137) 백엔드 요청: 대화 중계, 진행 상황, 지난번 답, 질문 code·답 source

- 브랜치: feature/assistant-backend
- 커밋: f9ae722..046b494 (7개)
- 주요파일: AssistantRelayService.java, AssistantRateLimiter.java, PreviousAnswerSuggester.java, ProgressService.java

## 한 일

- 카드 질문에 지난번 답 등급 `previous_answer`(carry, history)를 더했다. 고정비 6장은 carry, 건별 용도 4장은 history 이고, 적지 않으면 C(보여주지 않음)다. 로더, `RuleSet`, `validate_rules.py` 가 이 값을 검사한다.
- 질문 응답에 카드 질문 코드 `code` 를 실었다. 값은 기존 `question_queue.reason_code` 에서 읽어 마이그레이션이 없다. `POST /question-responses` 는 `source` 를 받고, 이 값은 `user_fact.source`(V14, 기본 `USER`)에 저장된다. 클라이언트가 `BULK` 를 보내면 400 이다.
- `GET /questions/suggestions`: 같은 사용자의 다른 업로드에서 지난번 답을 찾는다. A 등급은 값을 채우고, B 등급은 이력만 보여 준다. 등급 계산은 DB 를 쓰지 않는 순수 함수(`PreviousAnswerSuggester`)다.
- `GET /progress`: 업로드 하나의 분류, 문진, run, 질문 상태와 다음 할 일(`NextStep`)을 돌려준다. 새 패키지 `progress` 에 뒀다.
- `POST /assistant/chat`: 사용자의 `Authorization` 을 그대로 AI 서버에 넘기는 중계다. 맥락의 업로드나 거래가 남의 것이면 404 로 막는다. 사용자별 한도(동시 1, 분당 10, 하루 100, 한국 시각)는 Redis 로 센다. AI 서버 429 는 429 `ASSISTANT_RATE_LIMITED` 로, 그 밖의 실패와 Redis 장애는 503 `ASSISTANT_UNAVAILABLE` 로 바꾼다.
- 비서 도구가 부르는 API 11개에 다른 사용자의 ID 를 넣어도 그 사용자 데이터가 응답에 나오지 않는지 통합 테스트로 고정했다.

## 왜 이렇게 했나

- 등급은 백엔드 상수가 아니라 카드 YAML 에 둔다. 등급은 질문의 성격이라 카드를 정의할 때 함께 정하는 게 맞다. 그러면 `validate_rules` 로 검사할 수 있고, 카드 코드를 Java 에 다시 적지 않아도 된다.
- B 등급은 명세에 이름이 적힌 것만 넣었다. A 등급의 직전 답이 일괄 응답이면 값을 채우지 않고 이력만 보여 준다.
- 오류는 429 하나와 503 하나로 했다. 한도마다 `Retry-After` 초가 달라 화면 안내에는 이것으로 충분하다.
- 비서는 AI 서버에 따로 권한을 두지 않고 사용자 토큰으로 공개 API 를 부른다. 그래서 사용자 경계는 중계가 토큰을 바꾸지 않는 것과 공개 API 의 소유권 확인에 달려 있다. 이 두 가지를 테스트로 고정했다.
- 3주차 금액 PR(#184)과 서로 의존하지 않고 리뷰어도 달라 따로 올린다.

## 확인한 것

- `gradlew -p backend check` 통과(unit 377, integration 175, 벤치마크 1건은 건너뜀). `validate_rules.py` 는 errors 0, warnings 0. AI `test_sync_report` 통과.
- 중계의 소유권 확인을 지우면 `AssistantRelayIntegrationTest` 가 실패하는 것을 확인했다.

## 남은 것 · 아는 문제

- 일괄 응답(A7)은 #184 에 있다. 두 PR 중 나중에 머지되는 쪽에서 `bulkAnswer` 가 `AnswerSource.BULK` 를 넘기도록 한 줄 고쳐야 한다. 그 전까지 일괄 응답 답은 `USER` 로 남는다.
- `/classification-reviews` 는 아직 목 응답이라(#156) 사용자 경계 테스트에서 뺐다. #156 이 들어가면 목록에 더한다.
- AI `test_draft`, `test_assistant_*` 는 로컬 가상환경에 `langfuse` 가 없어 돌리지 못했다.
- AI 컨테이너는 백엔드와 같은 DB 계정을 쓴다. 지금 경로로는 데이터가 새지 않지만, 권한으로는 모든 사용자 데이터에 닿는다.

## 13:00 검증 에이전트가 찾은 결함 수정

- 커밋: 64a5fc8..b47f6a4 (4개)
- 결론을 주지 않은 별도 검증 에이전트로 PR 을 검증했다. 사용자 경계는 맞다고 확인됐고, 아래를 고쳤다. 고치기 전에 새 테스트가 실패하는 것을 먼저 봤다.
- `/progress` 의 다음 할 일에서 `RUN`(`/run`) 단계를 없앴다. `/run` 화면은 실행 id 없이 들어오면 판정을 새로 시작해 프론트와 AI 모두 그리로 가는 이동을 막는다. `/confirm` 은 판정 중에 다시 시작 버튼을 누르게 되어 쓰지 않았다. 판정 중이면 질문·결과로 간다. 프론트 목도 이렇게 동작한다.
- 중계가 빈 `history`·`context` 를 `null` 로 넘겨 AI 서버(pydantic)가 422 로 거절하던 것을 `@JsonInclude(NON_NULL)` 로 고쳤다. 가짜 AI 서버도 같은 경우 422 를 준다.
- 한도: 자리를 잡은 뒤 세다 Redis 오류가 나면 자리를 돌려준다. 자리 해제가 실패해도 받은 답을 버리지 않는다(TTL 이 푼다). Mockito 단위 테스트로 고정했다.
- 사용자 경계 테스트가 합계만 주는 요약 API 의 누출을 못 잡았다. 남의 금액(29,871)과 건수(`"totalCount":1`)도 찾고, 주인 대조를 엔드포인트마다 한다. 판정 조회의 사용자 필터를 지우면 이제 요약 2건도 실패한다.
- `gradlew -p backend check` 통과(unit 380, integration 185).
- 남은 것: AI 가 429·503 이어도 사용자 한도가 깎임, AI 응답 모양 검증 없음, `validate_rules.py` 가 code 별 등급 충돌을 못 잡음, 프론트 타입·목이 `/progress` 와 다름.
