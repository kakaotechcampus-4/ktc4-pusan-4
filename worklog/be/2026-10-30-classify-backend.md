# 분류 모델 연동(B10): 업로드 전 AI 서버에 미분류 가맹점을 묻고, 확실하면 확정·아니면 후보 3개

- 브랜치: feature/classify-backend
- 커밋: 11310a3..aadf5d8 (6개)
- 주요파일: UploadFacade.java, AutoConfirmPolicy.java, AiServerModelClassifier.java, V15__create_merchant_model_decision.sql

## 한 일

- `AiServerModelClassifier`: AI 서버 `POST /classify/merchants` 클라이언트. 요청 `{items: [{merchantNorm, merchantRaw}]}`, 응답 `{model, results[]}` 를 요청 순서로 짝짓고 `null` 칸은 뺀다. 연결 실패·타임아웃·4xx·5xx·응답 모양 이상은 모두 빈 맵 + WARN 한 줄(가맹점 수와 예외 종류만, 이름 없음)이다.
- `AutoConfirmPolicy`: `known ≥ 0.99` 이고 `confidence ≥ 0.995` 이며 top-1 이 허용 어휘 안이고 `기타`·`PG_미상` 이 아니면 확정한다. 후보는 같은 조건으로 걸러 최대 3개, 거절이면 없음.
- `UploadFacade`(트랜잭션 없음): 기능이 켜져 있고 살아 있는 Idempotency-Key·같은 fileHash 가 없을 때만, 규칙 분류를 읽기 전용으로 한 번 돌려 `UNCLASSIFIED` 이고 취소상계가 아닌 merchantNorm 을 최대 200개 모아 모델에 묻는다. 업로드마다 INFO 한 줄(보냄·자동 확정·후보 제시·실패 수). 컨트롤러는 이걸 부른다.
- `UploadService.upload(..., decisions)`: 트랜잭션 안에서 규칙 분류는 그대로 다시 하고, 여전히 미분류인 거래에 답이 있으면 정책을 적용한다. 확정이면 그 카테고리 + `CLASSIFIED`, 분류 확인 없음. 답이 있던 거래마다 `merchant_model_decision`(V15) 한 행을 남긴다. 기존 3인자 메서드는 빈 맵으로 위임한다.
- 분류 확인 목록: 거래 id 로 모델 답을 찾아 `suggestedCategories` 를 채운다(그룹은 첫 Review 의 후보). `NO_SUGGESTIONS` 를 지웠다.
- 설정 `app.classify.*`(기본 꺼짐, read-timeout 10s), compose `CLASSIFY_ENABLED`·`CLASSIFY_SERVER_URL`, `production.env.example` 에 `CLASSIFY_ENABLED`.
- 문서: api.md 3.5 `suggestedCategories` 설명과 예시에서 `기타` 제거, architecture.md 서버측 분류 절, backend_api_plan.md B10 과 10/16 결정 행(10/19 #145 결정, 10/30 실험).

## 왜 이렇게 했나

- 모델은 트랜잭션 밖에서 부른다. 안에서 부르면 응답을 기다리는 최대 10초 동안 사용자 잠금과 DB 커넥션을 잡는다. 그 사이 사전이 바뀌면 트랜잭션 안의 규칙 분류가 이긴다.
- 사전 확인은 "살아 있는 키가 있으면 건너뜀" 으로 했다. 같은 해시면 재전송이고 다른 해시면 409 라 어느 쪽도 저장하지 않으므로, 요청 해시를 계산해 비교할 필요가 없다(`UploadService.hash` 는 그대로 private).
- 꺼짐은 별도 구현체 대신 `UploadFacade` 가 `app.classify.enabled` 를 보고 건너뛴다. 꺼져 있을 때 읽기 전용 분류·사전 확인 쿼리도 돌지 않고, 조건부 빈 배선이 필요 없다.
- 모델 답은 `merchant_dict` 에 쓰지 않는다(CONTEXT.md 흔한 실수 #18). 후보는 원본 그대로 저장하고 읽을 때 거른다. 감사 기록이 원본을 갖고, 어휘가 바뀌면 화면도 따라간다.
- V15 의 `category`·`model` 은 `text` 다. 모델이 준 문자열이 길다고 INSERT 가 실패해 업로드가 깨지면 안 된다.
- 마지막 refactor 는 PMD 순환 복잡도(10)를 넘지 않게, 상태를 카테고리에서 정하도록 바꾼 것이다(`미분류` 면 `NEEDS_REVIEW`, api.md 2.4·V8 CHECK 와 같은 규칙).

## 확인한 것

- `gradlew -p backend check` 통과(unit 388, integration 203). `validate_rules.py` errors 0, warnings 0.
- 새 통합 테스트(`MerchantModelClassifyIntegrationTest`)는 가짜 AI 서버와 `@MockitoSpyBean` 으로 확정·후보 3개·취소상계 미전송·시간 초과(1초)·재전송/중복 파일 미호출·batch 삭제 CASCADE·포함 경로 후보를 본다. `UploadFacade.upload` 에 `@Transactional` 을 붙이면 6건 모두 실패하는 것을 확인했다.

## 남은 것 · 아는 문제

- AI 서버 쪽(PR 2)과 `docs/category_decision_eval.md`(PR 1)는 따로 들어온다. 계약이 바뀌면 `AiServerModelClassifier` 의 레코드만 고치면 된다.
- 요청의 거래 중 이미 저장된 naturalKey(건너뛸 거래)도 모델에 보낸다. 겹치는 기간을 다시 올리면 묻지 않아도 될 가맹점이 섞인다.
- 사전 확인은 잠금 없이 보므로 같은 키 동시 요청은 모델을 한 번 더 부를 수 있다. 결과는 같다.
- 분류 확인 목록은 모델 답을 `IN` 한 번으로 읽는다. 사용자 전체 batch 조회에서 Review 가 수만 건이면 바인드 한도에 닿는다.

## 15:59 자동 확정 제거 — 모델 답은 분류 확인 후보로만 (10/31)

- 커밋: b391f58..fe75f1a (2개)
- PR #196 리뷰 두 개가 모두 바로 확정하기보다 추천으로 가자고 했다. 가장 엄격한 기준에서도 실험 정밀도가 91%(하한 82%)라 확정하지 않기로 했다
- `AutoConfirmPolicy` 를 `SuggestionPolicy` 로 바꿨다. 확정 판단과 `known-min`·`confidence-min` 설정은 지우고, 후보 거르기(허용 어휘 안, `기타`·`PG_미상` 제외, 최대 3개, 거절이면 없음)만 남겼다
- `UploadService.store()` 는 분류 상태를 다시 `result.classified()` 로 정한다. 위 aadf5d8 의 카테고리 기준 판단은 확정 분기 때문에 넣은 것이라 되돌렸다. 모델 답은 거래마다 `merchant_model_decision` 에 남기기만 한다
- V15 에서 `auto_confirmed` 컬럼을 뺐다. 아직 머지 전이라 새 마이그레이션 대신 V15 를 고쳤다. `confidence`·`known` 은 남겨 실카드 정밀도를 다시 잴 때 쓴다
- `UploadFacade` 로그는 보낸 수 · 실패 수만 남긴다
- 통합 테스트: 확실한 답(known 0.99, confidence 1.00)도 `미분류` + `NEEDS_REVIEW` + 후보로 가고 사전에 쓰이지 않는 것을 본다
- 문서: api.md 3.5, architecture.md 서버측 분류, backend_api_plan.md B10 · 10/16 결정 행(10/31 결정)
- `gradlew check` 통과(unit 385, integration 203, PMD). unit 이 3개 준 것은 확정 판단 테스트를 지운 몫이다
- 남은 것: 되묻기 화면에서 "AI 가 추론함"과 "판단하지 못함"을 나누는 안(리뷰 제안)은 API 필드와 프론트가 필요해 후속이다
