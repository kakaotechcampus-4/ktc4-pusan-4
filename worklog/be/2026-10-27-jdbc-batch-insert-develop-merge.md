# jdbc-batch-insert(#172) 에 develop 을 merge 하고 새 테스트를 B6 생성자에 맞춘다

- 브랜치: refactor/jdbc-batch-insert
- 커밋: 86dd70f..6a6fe1e (2개)
- 주요파일: InsertOrderIntegrationTest.java

## 한 일

- develop(a7fb5a4)을 merge 했다. git 충돌은 없었다.
- 합친 상태에서 테스트 컴파일이 깨졌다. B6(3c450ea)이 `UploadBatchEntity` 생성자에 `int skippedDuplicateCount` 를 더했는데, 이 브랜치가 새로 넣은 `InsertOrderIntegrationTest.newBatch` 가 예전 4개 인자 생성자를 썼다. 중복 수 자리에 `0` 을 넣었다. 이 테스트는 insert 순서만 보고 중복 수는 보지 않는다.

## 왜 이렇게 했나

- 이미 push 된 브랜치라 rebase + force push 대신 merge 했다.
- 이 파일이 이 브랜치에만 있어 git 충돌로는 드러나지 않고, 브랜치 혼자서는 CI 가 통과한다. develop 과 합쳐 컴파일해 봐서 찾았다.

## 확인한 것

- `gradlew -p backend check` 통과(test 349, integrationTest 145, 스킵 0). `InsertOrderIntegrationTest` 포함.
