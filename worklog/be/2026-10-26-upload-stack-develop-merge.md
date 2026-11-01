# 업로드 스택(#130·#147·#148)에 develop 을 merge 해 판정 PR 과의 충돌을 푼다

- 브랜치: feature/upload-idempotency, feature/upload-batches, feature/transactions-api
- 커밋: 9c23648 (merge) 외 스택 merge 2개
- 주요파일: ApiResponseContractTest.java

## 한 일

- #130 이 develop 과 충돌해 머지 버튼이 막혀 있었다. develop(224efa4)을 feature/upload-idempotency 에 merge 했다.
- `ApiResponseContractTest`: #131~#135(판정 조회·질문·조문)가 같은 자리에 목 빈과 스텁을 더했고 #130 은 `UploadService` 목을 더했다. 둘 다 남겼다. develop 쪽을 먼저 두고 `@MockitoBean UploadService` 와 업로드 스텁을 뒤에 붙였다.
- 이 브랜치를 feature/upload-batches(#147)에, 그 브랜치를 feature/transactions-api(#148)에 차례로 merge 했다. 충돌은 없었다.

## 왜 이렇게 했나

- 이미 push 된 스택 브랜치라 rebase + force push 대신 merge 했다.
- 스택 아래부터 develop 을 조상으로 만들어 두면, #130 을 머지한 뒤 #147·#148 의 base 를 develop 으로 바꿔도 merge base 가 하나라 GitHub 가 충돌로 보지 않는다(2026-10-22 judgments-query 때와 같은 이유).

## 확인한 것

- 같은 해결로 develop + #148 을 합친 상태에서 `gradlew -p backend check` 통과(2026-10-26, refresh-token-redis 작업의 바탕 브랜치).

## 남은 것 · 아는 문제

- #130 머지 → #147 base 를 develop 으로 → 머지 → #148 같은 순서로 진행한다.
