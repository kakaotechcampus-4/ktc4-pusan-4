# 문진을 고치면 같은 트랜잭션에서 한도를 다시 집계한다 (#218, PR #234 리뷰 반영)

- 브랜치: perf/limit-settlement-on-answer
- 커밋: 173b984..5108493 (2개)
- 주요파일: BusinessContextRevisionService.java, BusinessContextController.java, TransactionRecordEntity.java, LimitSettlementIntegrationTest.java

## 한 일

- 문진 생성(`POST /users/me/contexts`)이 `BusinessContextRevisionService.create` 를 부른다. 문진 새 버전을 저장하고 같은 트랜잭션에서 `settleProvisional` 을 부른다. 조회(`current`, `history`)는 그대로 `BusinessContextService` 다.
- `TransactionRecordEntity.currentJudgmentId` 주석에 "같은 트랜잭션에서는 `pointCurrentJudgment` 뒤에도 엔티티에 이전 값이 남으니 읽지 말고 `findCurrentJudgmentId` 로 읽을 것"을 더했다.
- CONTEXT.md §4 집계 시점: 2026-11-03 에 적은 "문진 수입금액은 다음 집계 때 반영"을 "문진 저장과 같은 트랜잭션에서 다시 집계"로 바꿨다. `LimitSettlementService` 의 호출처 주석에 "문진 수정"을 더했다.

## 왜 이렇게 했나

- 리뷰(memoryhong): 한도는 최신 문진의 직전연도 수입금액으로 정해지는데 문진 저장이 집계를 부르지 않는다. 이 PR 전에는 질문 답마다 집계가 돌아 곧 반영됐지만, 이제는 접대비와 닿는 일이 생길 때까지 옛 한도 기준 초과액이 화면에 남는다. 이 PR 이 공백을 늘렸으므로 같이 막는다.
- `BusinessContextService.create` 안에서 부르지 않은 이유: `LimitSettlementService` 가 이미 `BusinessContextService` 를 주입받는다(수입금액 조회). 반대로도 주입하면 생성자 주입이 순환해 기동이 안 되고, 지금 `judgment` 를 모르는 `user` 모듈이 `judgment` 를 알게 된다.
- 다른 선택지:
  - 컨트롤러가 두 서비스를 따로 부르기: 트랜잭션이 둘로 나뉘어, 집계가 실패하면 문진은 저장됐는데 500 이 나간다.
  - 문진 저장 이벤트: 의존 방향은 지키지만 흐름이 코드에서 안 보인다. 이 PR 에서 DB 트리거 대신 쓰는 곳 3곳에서 명시적으로 바꾼 것과 같은 이유로 고르지 않았다.
  - `LimitSettlementService` 에 문진 생성 메서드 추가: 클래스는 안 늘지만 집계 서비스가 문진 생성까지 맡는다.
- 락 순서: 문진 저장은 `app_user` 행만, 집계도 같은 `app_user` 행만 잠그고 거래 락은 잡지 않는다. 같은 트랜잭션이라 다시 잡아도 막히지 않고, 새 락 순서가 생기지 않는다.
- 엔티티 값 문제는 주석만 더했다. getter 가 없어 지금 틀리는 곳은 없다. `@Modifying(clearAutomatically = true)` 는 영속성 컨텍스트를 비워, `ClassificationReviewService` 처럼 거래 엔티티를 들고 있는 쪽의 이후 변경을 잃게 하므로 쓰지 않았다.

## 확인한 것

- 테스트를 먼저 쓰고 실패를 확인했다: 수입금액 3,000만원 → 1억원으로 문진을 고친 뒤 2025년 초과액이 291만원 그대로였다. 집계를 넣은 뒤 270만원(한도 1,230만원)으로 통과.
- 처음 `check` 에서 `ApiResponseContractTest` 67건이 실패했다. 컨트롤러가 새 서비스를 받는데 슬라이스 테스트에 mock 이 없어 컨텍스트가 안 떴다. mock 을 더하고 문진 생성 응답을 그 mock 에서 돌려주게 했다.
- `gradlew check` 통과(단위 409, 통합 292 중 건너뜀 7 은 환경변수로 도는 벤치마크, 실패 0).

## 남은 것 · 아는 문제

- 수입금액이 그대로인 문진 수정도 집계한다. 집계가 몇 ms 라 값 비교로 건너뛰지 않았다.
- `user/api` 컨트롤러가 `judgment.persistence` 서비스를 참조하게 됐다. `user` 의 서비스·도메인은 여전히 `judgment` 를 모른다.
