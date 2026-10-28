# 3주차 트랙 A: 인정 금액 계산, 접대비 한도 잠정 집계, 일괄 응답

- 브랜치: feature/judgment-amount-week3
- 커밋: de0852a..3f2e8a0 (7개)
- 주요파일: AmountCalculator.java, LimitSettlementService.java, QuestionAnswerService.java, JudgmentRepository.java

## 한 일

- A7: `POST /questions/bulk-answer` 의 목 응답을 실제 답변과 재판정으로 바꿨다. 소명 대기가 섞인 그룹은 빼고, 모든 답을 먼저 기록한 뒤 한 번에 재판정한다. `JudgmentMockData` 는 지웠다.
- 자택 겸용(R-103 v2, R-210 v3)을 `verdict: 가능` 과 `안분: 작업공간비율` 으로 바꿨다. 문진에 비율이 없으면 엔진이 확인필요로 둔다. E-036 보류를 풀었다.
- A6a: `AmountCalculator` 가 안분 다음 첫해 상각 순서로 인정 금액을 계산한다. 원 미만은 단계마다 버린다. 판정, 재판정, 사용자 수정 revision 에 `final_amount` 를 저장한다. 평가셋 금액 채점을 켰다.
- A6b: run 이 끝날 때와 재판정 뒤에 접대비 한도를 잠정 집계해 `limit_bucket_entry` 에 넣는다(소득세법 §35 3항, 기본한도 1,200만원).
- 한도 집계가 판정 엔티티 전체를 읽어 3,000건에서 OutOfMemoryError 가 났다. 필요한 값만 꺼내는 projection 조회 `findCurrentLimitTagged` 로 바꿨다.

## 왜 이렇게 했나

- 안분을 먼저 하고 부가세를 나중에 본다. 가사 몫은 물건값도 매입세액도 인정되지 않기 때문이다. 페르소나(940909)는 면세사업자라 부가세 단계는 꺼 두었다. 근거는 `CONTEXT.md` §4 에 있다.
- `finalAmount` 에는 안분과 상각까지만 넣고 한도는 넣지 않는다. 판정은 revision 을 쌓는 구조라, 한도를 넣으면 다시 계산할 때마다 같은 버킷의 다른 판정까지 바꿔야 한다.
- 혼용은 확인필요, 0원으로 둔다. 비율(%)을 받을 질문이 없고, `CONTEXT.md` G3 과 E-038 도 그렇게 적혀 있다.
- 중소기업 기본한도(3,600만원)는 문진으로 알 수 없다. 그래서 덜 인정하는 일반 한도를 쓴다.
- 3주차는 PR 하나로 올리고, 1000줄 규칙은 커밋마다 지킨다. 2주차 스택 PR 에서 base 를 바꾸고 merge 를 반복했던 비용을 피하려는 것이다.

## 확인한 것

- `gradlew -p backend check` 통과(unit 370, integration 158). `validate_rules.py` 는 errors 0, warnings 0.
- 로컬 백엔드에서 API 로 끝까지 돌려 금액이 맞는 것을 봤다. 자택 겸용 16,000, 자산 751,666, 한도 8,000,000 / 4,090,000 / 0.
- 쿼리 수는 develop 과 같이 거래당 13문장이다. 접대비 판정 하나마다 한도 항목 INSERT 가 1문장씩 더 나간다. 질문 답변 1건은 거래 수와 상관없이 25문장 정도다.

## 남은 것 · 아는 문제

- override, 거래 제외·포함, batch 삭제 뒤에는 한도를 다시 집계하지 않는다.
- 한도를 넘어 깎인 금액을 보여주는 API 가 없다. 요약의 접대비 합계에 한도 초과분이 들어 있다.
- 혼용 비율 입력(#65), 선급비용 기간배분(E-043), 부가세 단계, 접대비 배분 순서(#15)가 남았다.
- (기존 문제) 판정 행마다 batch 의 UserFact 전부를 `input_facts` 로 저장한다. 그래서 답이 많은 batch 의 run 은 거래 수의 제곱에 비례해 느려진다.
- 비서 PR(feature/assistant-backend)과 함께 들어가면, 나중에 머지되는 쪽에서 일괄 응답이 `AnswerSource.BULK` 를 넘기도록 한 줄 고쳐야 한다.
