# #133 에서 정한 판정 요약 동작을 api.md 3.7 에 옮겼다

- 브랜치: feature/judgments-summary
- 커밋: 3754d3f (1개)
- 주요파일: docs/api.md

## 한 일

- `byVerdict` 는 세 verdict 를 늘 담고, 금액이 아직 없는 판정은 0 으로 더한다
- `byAccount` 는 AVAILABLE 이면서 계정이 있는 판정만, `finalAmount DESC` 에 같으면 계정 이름순
- 다른 사용자의 `batchId`·`runId` 는 404 가 아니라 빈 집계

## 왜 이렇게 했나

- #133 설명의 「api.md 에 정해져 있지 않은 부분」 세 가지에 FE 가 동의했다. FE 목이 api.md 를 따르므로 문서에 적어 둔다
- 금액을 0 으로 더하는 것은 A6a 전까지 요약 금액이 0원으로 보이는 이유라 같이 적었다(`JudgmentSummary.of`)

## 남은 것 · 아는 문제

- 판정 목록(#132)과 질문 응답(#135)의 결정은 각 PR 브랜치에 따로 적는다
