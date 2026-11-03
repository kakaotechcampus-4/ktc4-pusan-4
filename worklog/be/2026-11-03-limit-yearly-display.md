# 접대비 한도를 거래별로 나누지 않고 연 초과액으로 준다 (#15)

- 브랜치: feature/limit-yearly-display (develop cd0f86d 에서 시작)
- 커밋: d84294c..a9b3567 (2개)
- 주요파일: JudgmentQueryService.java, LimitBucketEntryRepository.java, LimitYearResponse.java, docs/api.md

## 한 일

- `GET /judgments/summary`·`/export` 응답에 `limits`(`bucket`, `taxYear`, `totalAmount`, `excessAmount`)를 더했다. 범위(`batchId`, `year`)에 접대비 판정이 있는 과세연도마다 하나, 값은 그해 사용자 전체 기준이다. `runId` 범위는 빈 배열이다.
- `batchId` 요약은 접대비도 `finalAmount` 로 더한다. #184 에서 한도 인정액 합으로 바꿨던 것을 batch 범위에서만 되돌렸다. `year` 요약은 그대로 한도 인정액 합이다.
- 내보내기의 접대비 `allowedAmount` 는 그해 한도를 넘었으면 `null` 이다. 넘지 않았으면 지금과 같다.
- `api.md` 3.7, `CONTEXT.md` §4 집계 단계와 결정 표(26번, 미결정 #4 종결, #5 는 발표 이후), `docs/limit-settlement.md` 에 적었다.
- 배분 계산(`AnnualLimitAllocator`), `limit_bucket_entry`, 집계 시점은 그대로다.

## 왜 이렇게 했나

- 2026-09-13 #15 결정("거래별 귀속을 하지 않는다")과 `CONTEXT.md` G6 팀 결정이 문서·코드에 반영되지 않아, A6b(#184)·내보내기(#214)가 승인일 순 배분값을 내보내고 있었다. 어느 거래를 초과분으로 볼지는 법이 정하지 않는다(#15 10/30 댓글).
- 표시 방식은 사용자와 정했다. 한도 전에는 접대비 행도 인정 금액을 보이고, 넘은 해에는 행에 인정액 대신 한도 대상 표시와 연 초과액만 둔다. 넘은 해에 전액을 "인정 금액"으로 찍으면 틀린 값이라 비운다.
- batch 몫은 순서 없이 나눌 수 없어 batch 요약은 한도 전 금액으로 두고 초과액은 `limits` 로 뺐다.
- 확정 전환·연말 재배분·#203 은 발표 이후로 미뤘다. 세무사 답변(9/18 Q14)이 수입 7,500만원 규모면 한도를 넘는 일이 많지 않다고 했다.
- 한도 상태는 `summary`·`export` 시그니처를 바꾸지 않고 `limits()` 로 따로 읽어 컨트롤러가 붙인다. 두 메서드를 쓰는 기존 호출(벤치마크 테스트 포함)이 그대로 돈다.

## 확인한 것

- 테스트를 먼저 쓰고 실패를 본 뒤 구현했다(요약 batch/year, limits, batch 연도 필터, 내보내기 null, API 응답). batch 연도 필터는 구현을 사용자 전체 연도로 바꿔 테스트가 실패하는 것을 보고 되돌렸다.
- `QuestionAnswerIntegrationTest` 는 고정 사용자를 공유해 한 해 합계에 다른 테스트 데이터가 섞였다. 한도 테스트의 거래를 다른 테스트가 쓰지 않는 해(2031, 2032 평일)에 두었다.
- `gradlew -p backend check` 통과(unit 409, integration 283, 건너뜀 4 은 환경변수로 도는 벤치마크). `tools/validate_rules.py` errors 0.

## 남은 것 · 아는 문제

- FE 와 같이 머지해야 한다. develop FE `utils/limit.ts` 는 초과액을 `finalAmount − allowedAmount` 로 세서, `allowedAmount` 가 `null` 이면 초과액이 접대비 전액으로 부풀려진다. 요약 화면의 "한도 인정액입니다" 문구도 batch 요약과 맞지 않게 된다.
- AI 비서 `ai/assistant/tools.py` `get_summary` 는 `limits` 를 넘기지 않아, batch 요약의 초과분을 모른다.
- 노션 기능명세서 7.2·7.5 가 아직 거래별 배분을 전제로 적혀 있다.

## 19:34 재판정 뒤 한도 집계를 빠르게 하고, 접대비와 닿지 않으면 건너뛴다 (#218)

- 브랜치: perf/limit-settlement-on-answer (develop 882664b 에서 시작)
- 커밋: 1231b69..69494b0 (4개)
- 주요파일: JudgmentRepository.java, LimitSettlementService.java, ClassificationReviewService.java, CONTEXT.md

### 한 일

- `findCurrentLimitTagged` 를 거래마다 현재 판정 하나를 `join lateral` 로 찾는 조회로 바꿨다. 결과는 이전 조회와 같다(같은 데이터에서 두 조회 결과 집합 비교).
- `settleProvisional` 이 시작할 때 그 트랜잭션에서만 JIT 를 끈다(`set_config('jit', 'off', true)`).
- 재판정 뒤에는 `settleAfterRejudge` 를 부른다. 다시 판정한 거래의 판정(이전 revision 포함) 중 가능·접대비가 하나도 없으면 집계를 건너뛴다.
- 분류 응답(`ClassificationReviewService`)이 거래마다 `executor.judge` 를 부르던 것을 질문 답과 같은 `executor.rejudge` 로 바꿨다. batch UserFact 를 한 번만 읽고, 위 건너뛰기도 같이 탄다.
- `CONTEXT.md` §4 집계 시점에 건너뛰기와 문진 수입금액 반영 시점을 적었다.

### 왜 이렇게 했나

- 측정해 보니 집계 시간 대부분이 조회였다. 원인은 두 가지였다.
  - 플래너가 "현재 판정" 조건(OR + 상관 서브쿼리)을 1행으로 잘못 추정해, ANALYZE 뒤 판정마다 거래 테이블을 다시 훑는 계획으로 바뀌었다. 접대비 수가 그대로인데 집계가 갑자기 느려지던 이유다.
  - 추정 비용이 `jit_above_cost` 를 넘어 JIT 컴파일이 실행보다 오래 걸렸다(거래 6,000건에서 54ms 중 29ms).
- 식 통계(`create statistics`)로 추정을 고쳐 보려 했지만 계획이 바뀌지 않았다. lateral 은 거래 수에 비례하는 계획으로 고정된다.
- 건너뛰기가 맞는 이유: 재판정은 그 거래들의 현재 판정만 바꾼다. 그 거래들의 어느 판정도 접대비가 아니면 집계 대상 목록이 그대로다. 이전 revision 까지 보므로 "접대비였다가 빠진" 경우도 집계한다.
- 이슈의 3번(바뀐 과세연도만 배분)과 4번(바뀐 항목만 쓰기)은 하지 않았다. 조회를 고친 뒤 남은 비용은 거래 수에 비례하는 조회이고, 3·4번은 그 조회를 줄이지 않는다.
- 분류 응답도 측정했다(거래 9,000건, 미분류 가맹점 30곳). 응답 30건 모두 한도 항목이 바뀌지 않았는데 매번 집계했다(응답당 약 36ms). 또 거래마다 batch UserFact 를 다시 읽었다(300번, 725ms).

### 확인한 것

- 같은 조건 측정(측정용 테스트, 커밋하지 않음. 답 100건마다 ANALYZE), 고치기 전 → 뒤:
  - 질문 답: 업로드 1 의 1,000건 무렵 답 48 → 51ms, 집계 조회 130 → 19ms / 1,110건 무렵 답 171 → 51ms, 조회 134 → 20ms. 고친 뒤 JIT 0번.
  - 분류 응답: 평균 343 → 215ms, 중앙값 290 → 140ms. 집계 조회 실행 안 됨, UserFact 조회 300번 → 30번.
- 테스트를 먼저 쓰고 실패를 확인했다: 접대비와 상관없는 질문 답·분류 응답은 한도 항목을 건드리지 않음, 접대비 답을 고치면 다시 집계함, 집계 트랜잭션 안에서만 JIT 가 꺼짐.
- #226 과 테스트 파일이 겹쳤지만 자동으로 합쳐졌다. 한도 항목 값을 바꿔 두는 질문 답 테스트는 #226 처럼 다른 테스트와 겹치지 않는 해(2033)에 두었다.
- `gradlew -p backend check` 통과(테스트 699, 실패 0, 건너뜀 7 은 환경변수로 도는 벤치마크).

### 남은 것 · 아는 문제

- 문진을 고쳐도 집계를 부르지 않는다. 지금까지는 질문 답마다 집계가 돌아 바뀐 수입금액이 반영됐는데, 이제는 업로드·접대비 관련 답·거래 제외 등 다음 집계 때 반영된다. #226 이후 초과액이 화면에 나오므로 늦게 반영되면 보인다.
- 남은 집계 비용은 사용자 거래 수에 비례한다(거래당 약 5µs).
- 분류 응답은 고친 뒤에도 1건에 215ms 이고, DB 시간은 10ms 안팎이다. 나머지가 어디서 쓰이는지는 보지 않았다.
- 조건마다 한 번씩만 쟀다.
