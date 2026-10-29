# R-060 PR CI 실패 — 통합 테스트 조문 시드 보강

- 브랜치: feature/r060-card-evidence
- 커밋: 1개
- 주요파일: QuestionAnswerIntegrationTest.java

## 한 일

- QuestionAnswerIntegrationTest 의 시작 조문 목록에 `소득세법시행령-208의2-4`(R-060), `62`·`67-4`·`67-5`·`67-7`(R-241)을 더했다.

## 왜 이렇게 했나

- PR #190 CI 에서 `personal_answer_to_awaiting_explanation_cancels_other_questions_of_the_transaction` 이 판정 저장 중
  `IllegalStateException`(StatuteVersions: "Expected one effective statute version") 으로 실패했다.
  판정 저장은 카드가 인용한 조문마다 statute_version 행이 있어야 하는데, 이 테스트는 7개만 넣었다.
  R-060 의 새 인용과, 금액을 150만원으로 올리며 새로 걸린 R-241 의 인용이 없었다.
- 로컬은 Docker 데몬이 꺼져 있어 통합 테스트를 못 돌렸다. 컴파일만 확인했고 결과는 CI 로 본다.
