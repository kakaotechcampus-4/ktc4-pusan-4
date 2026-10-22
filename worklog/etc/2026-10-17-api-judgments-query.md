# #132 에서 정한 판정 목록 동작을 api.md 3.7 에 옮겼다

- 브랜치: feature/judgments-query
- 커밋: aaa9316 (1개)
- 주요파일: docs/api.md

## 한 일

- 조건은 모두 AND, 범위 조건이 없으면 본인 전체의 현재 판정, 다른 사용자의 id 는 404 가 아니라 빈 목록
- `batchId`·`year` 현재 판정에서 분류 확인 전 거래도 빠진다는 것을 §5 와 함께 적었다
- `transactionId` 로 현재 판정을 부르면 제외·분류 전 거래도 나온다. `latestOnly=false` 는 `transactionId` 없이도 모든 revision
- `runId` 와 `latestOnly` 를 함께 보내면 `latestOnly` 는 무시한다
- `explanation` 은 RuleCard 에 설명 필드가 없어 지금은 늘 null 이다

## 왜 이렇게 했나

- #132 설명의 「api.md 에 없는 부분」 1~5 에 FE 가 동의했다. FE 목은 api.md 를 따르므로, 문서에 없으면 목과 실서버가 다시 갈린다
- 코드(`JudgmentRepository.findPage`)에서 읽히는 동작만 적었다. 이 PR 에서 api.md 를 고쳐야 코드와 문서가 같이 들어간다

## 남은 것 · 아는 문제

- summary(#133)와 질문 응답(#135)의 결정은 각 PR 브랜치에 따로 적는다
