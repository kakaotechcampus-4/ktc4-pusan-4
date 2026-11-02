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
