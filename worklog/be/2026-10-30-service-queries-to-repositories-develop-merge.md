# service-queries-to-repositories(#186) 에 develop 을 merge 해 충돌을 푼다

- 브랜치: refactor/service-queries-to-repositories
- 커밋: 82d580d (merge 1개)
- 주요파일: ClassificationReviewEntity.java

## 한 일

- #186 이 develop 과 충돌(CONFLICTING)해서 develop(9ae07b7)을 이 브랜치에 merge 했다. 갈라진 뒤 develop 에 쌓인 커밋은 53개다.
- `ClassificationReviewEntity`: develop(#158)은 `id()`·`transactionId()`·`resolved()`·`resolve(...)` 를 더했고, 이 브랜치는 `AssignedIdEntity` 상속과 `getId()` 를 더했다. 둘 다 남겼다. `JudgmentEntity` 와 같은 순서가 되도록 `getId()` 를 `id()` 바로 뒤에 두었다.

## 왜 이렇게 했나

- 이미 push 된 브랜치라서 rebase + force push 대신 merge 했다.
- `id()` 와 `getId()` 가 같은 값을 돌려주며 둘 다 남는다. `getId()` 는 `Persistable` 이 요구하는 public 메서드라 지울 수 없고, 프로젝트 코드에서 부르는 곳은 없다. 도메인 코드는 레코드식 `id()` 를 쓴다. develop 의 `JudgmentEntity` 도 이미 둘 다 갖고 있어서 그 모양을 따랐다.
- develop 에 새로 들어온 `ClassificationReviewService` 는 리뷰를 조회해 값만 바꾸고 `save`·`persist` 를 부르지 않는다. 그래서 `AssignedIdEntity.isNew()` 와 부딪히지 않는다.

## 확인한 것

- `gradlew -p backend test` 통과.

## 남은 것 · 아는 문제

- `integrationTest` 는 Docker 가 꺼져 있어 돌리지 못했다. DB 를 거치는 동작은 이 merge 기준으로 아직 확인하지 않았다.
- `id()`·`getId()` 를 하나로 합치려면 `AssignedIdEntity` 를 상속하는 엔티티 전체와 호출부를 함께 바꿔야 한다. 이 PR 범위 밖이라 하지 않았다.
