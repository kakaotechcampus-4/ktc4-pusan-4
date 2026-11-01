# bearer-access-token(#154) 에 develop 을 merge 해 충돌을 푼다

- 브랜치: feature/bearer-access-token
- 커밋: 45ee509 (merge 1개)
- 주요파일: ApiResponseContractTest.java, BackendApplicationIntegrationTest.java

## 한 일

- #154 가 develop 과 충돌(CONFLICTING)해 develop(aa41ffc)을 이 브랜치에 merge 했다. 브랜치는 a164799(10/17)에서 갈라졌고 그 뒤 develop 커밋은 172개다.
- `ApiResponseContractTest`: develop 은 B7(b5e77d6)에서 `TransactionMockData` 를 지우고 판정·업로드·거래 서비스 목을 더했고, 이 브랜치는 같은 import 와 `@Import` 줄의 `TemporaryCurrentUserProvider` 를 `FixedUser`·`TestAuthentication` 으로 바꿨다. develop 쪽을 쓰고 사용자 참조만 이 브랜치 것으로 바꿨다. `@Import` 에서 `TransactionMockData` 는 뺐다.
- `BackendApplicationIntegrationTest`: develop 이 B3b(07d5b46)에서 분류기 import 와 `merchant_classifier_loads_rules_on_startup` 를 더한 자리와 겹쳤다. 둘 다 남기고 새 테스트의 `TEMPORARY_USER_ID` 를 `FixedUser.ID` 로 바꿨다.
- 충돌은 없지만 지운 `TemporaryCurrentUserProvider` 를 쓰는 develop 테스트 4개(`JudgmentQuery`·`QuestionAnswer`·`QuestionQuery`·`UploadIdempotency` IntegrationTest)도 `FixedUser.ID` 로 바꿨다. 2026-10-18 worklog 에 적어 둔 그대로다.

## 왜 이렇게 했나

- 이미 push 된 브랜치라 rebase + force push 대신 merge 했다.

## 확인한 것

- `gradlew -p backend check` 통과(test 348, integrationTest 127).

## 남은 것 · 아는 문제

- #155(feature/fixed-jwt-auth)는 이 브랜치 위에 쌓여 있어 이 merge 를 다시 받아야 한다.
- `backend/README.md` 71줄이 develop 에서 지운 `TransactionMockData` 를 아직 목 응답 예로 든다. develop 에서 생긴 일이라 여기선 고치지 않았다.

## 13:12 fixed-jwt-auth(#155) 에 bearer-access-token 을 merge 한다

- 브랜치: feature/fixed-jwt-auth
- 커밋: 04109f9 (merge 1개)

### 한 일

- 위 merge 를 받으려고 feature/bearer-access-token(a6eefbf)을 이 브랜치에 merge 했다.
- `ApiResponseContractTest`: develop 에서 온 `UploadService`·`UploadBatchService`·`TransactionService` 목과 이 브랜치의 `AuthService` 목이 같은 자리에 붙어 충돌했다. 둘 다 남기고 develop 쪽을 앞에 뒀다.

### 확인한 것

- `gradlew -p backend check` 통과(test 359, integrationTest 132).
