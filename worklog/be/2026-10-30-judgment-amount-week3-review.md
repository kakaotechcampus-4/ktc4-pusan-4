# 3주차 PR(#184) 리뷰 반영: develop merge, 일괄 응답 결함, 한도 재집계 경로

- 브랜치: feature/judgment-amount-week3
- 커밋: ae5588d..789959f (7개, develop merge 포함)
- 주요파일: QuestionAnswerService.java, LimitSettlementService.java, ClassificationReviewService.java, JudgmentOverrideService.java

## 한 일

- develop 을 merge 했다(#158 분류 응답, #185 비서, #170, #163). 충돌은 README 목 응답 문단, `QuestionAnswerService`, `ApiResponseContractTest` 셋이었다. 이 merge 로 남은 `*MockData` Bean 이 없어져 README 를 그렇게 고쳤다.
- 일괄 응답이 UserFact 출처를 `BULK` 로 저장한다. #185 가 출처를 더했는데 일괄 응답만 `USER` 로 남겼다.
- 일괄 응답이 대상을 읽기 전에 사용자 락을 잡는다. 사용자 락은 `LimitSettlementService.lockUser` 로 열었다.
- 일괄 응답의 `answeredCount` 는 요청 당시 PENDING 이던 수다. 함께 다시 답한 ANSWERED 형제는 세지 않는다(api.md 3.11).
- api.md 3.11 에 재판정 문진 버전 규칙(대상 중 가장 큰 버전 하나)을 적었다.
- 분류 응답(#158)의 재판정 뒤에 한도를 다시 집계한다. 요청·거래 락보다 사용자 락을 먼저 잡는다.
- override 와 그 해제, 거래 제외·포함, batch 삭제 뒤에도 한도를 다시 집계한다. 앞의 셋은 사용자 락을 먼저 잡는다.
- 집계는 갈아 끼울 항목이 없으면 문진을 읽지 않고 끝낸다.

## 왜 이렇게 했나

- 리뷰(memoryhong)가 #158 재집계와 일괄 응답 락을 이번 PR 에 넣자고 했고, 사용자는 정책 결정이 필요 없는 남은 일을 모두 처리하자고 했다.
- 분류 응답에 집계만 끝에 붙이면 거래 → 사용자 순서가 된다. 질문 응답은 사용자 → 거래 순서라 둘이 겹치면 교착할 수 있다. `rejudge(List)` 를 지운 이유와 같다.
- override 해제는 거래 락을 잡지 않지만 수정 행을 고친다. override 는 사용자 락 → 수정 행 순서로 잡아서, 해제도 사용자 락을 먼저 잡아야 순서가 맞는다.
- 문진 전 사용자도 거래를 제외할 수 있다. 처음 구현에서는 집계가 문진을 읽다가 422 "문진 전입니다" 를 던져 `TransactionIntegrationTest` 2건이 실패했다.
- 사용자 락은 거래 모듈(`UserWriteLock`, `for update`)이 아니라 집계와 같은 `for no key update` 를 쓴다. 집계가 잡는 락과 같은 것을 먼저 잡는 게 목적이고, `for update` 는 다른 트랜잭션의 FK 검사(key share)까지 막는다.

## 확인한 것

- 고친 것마다 고치기 전에 새 테스트가 실패하는 것을 먼저 봤다. 일괄 응답 락은 다른 트랜잭션이 사용자 락을 잡은 채 대상 질문을 취소하는 상황을 만들어, 고치기 전에는 `NoSuchElementException`(500)이 나는 것을 확인했다.
- `gradlew -p backend check` 통과(unit 398, integration 214, 벤치마크 1건은 환경변수로 건너뜀).

## 남은 것 · 아는 문제

- 정책 결정이 필요해 두었다: 요약을 한도 인정액 기준으로 바꾸기(API·FE 계약), 확정 항목을 잠정 집계가 덮어쓰는 것(잠정/확정 전이 규칙, CONTEXT.md 미결정 5번), 혼용 비율 입력, 접대비 배분 순서(#15), 중소기업 한도, 자택 겸용 비율 없음 안내.
- 집계 실패를 run·답변과 떼어 놓는 것은 여전히 하지 않았다(같은 트랜잭션, 락 재설계 필요).
- 거래 제외·포함과 batch 삭제가 이제 한도 집계 쿼리를 한 번씩 더 돈다. 접대비 판정이 없는 사용자는 사용자 락과 조회 두 번으로 끝난다.
- 교착 자체를 재현하는 테스트는 없다. 락 순서는 코드로만 맞췄다.
