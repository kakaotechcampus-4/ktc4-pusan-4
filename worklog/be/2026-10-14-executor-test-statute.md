# 판정 실행기 통합 테스트에 시행령 61-1-1 조문을 넣어 develop CI 를 복구

- 브랜치: hotfix/executor-test-statute
- 커밋: 2009062..2009062 (1개)
- 주요파일: JudgmentExecutorIntegrationTest.java

## 한 일

`JudgmentExecutorIntegrationTest` 의 `setUp` 이 `statute_version` 에 넣는 조문 목록에
`소득세법시행령-61-1-1` 을 추가했다.

## 왜 이렇게 했나

#126(판정 실행기) 머지 직후 develop 의 Backend CI `integrationTest` 에서 이 클래스 4개가
`IllegalStateException: Expected one effective statute version for 소득세법시행령-61-1-1` 로 실패했다.
#119 의 `5d36eed` 가 카페 카드(R-300, R-312) 인용에 시행령 61-1-1 을 추가했는데,
#126 브랜치에는 그 커밋이 없어 PR CI 는 통과했고 develop 에서 둘이 합쳐진 뒤에야 깨졌다.
카드의 인용은 원문 대조를 거친 `verified: true` 라 되돌리지 않고 테스트 seed 를 맞췄다.

로컬에서 수정 전 같은 4개 실패를 재현했고, 수정 후 `integrationTest` 전체가 통과했다.

## 남은 것 · 아는 문제

`feature/question-responses` 도 아직 `5d36eed` 가 없다. develop 을 merge 하면
`JudgmentRunIntegrationTest`, `QuestionAnswerIntegrationTest` 의 조문 seed 에도 같은 조문을 넣어야 할 가능성이 크다.
