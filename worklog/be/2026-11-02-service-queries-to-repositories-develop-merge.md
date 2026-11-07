# service-queries-to-repositories 에 develop 을 다시 합친다 (#186)

- 브랜치: refactor/service-queries-to-repositories
- 커밋: 4c16b2c (머지 1개)
- 주요파일: ClassificationReviewEntity.java

## 한 일

- `ClassificationReviewEntity` 의 `getId()` 를 develop(#174 가 이 PR 을 먼저 합쳐 들어감)과 이 브랜치가 각각 다른 자리에 더해 충돌했다. 내용이 같아 develop 쪽 위치를 그대로 썼다. 이 파일은 develop 과 diff 가 없다.

## 확인한 것

- develop + #172 + #186 + #214 를 합친 트리에서 `gradlew -p backend check` 통과(테스트 676개, 실패 0).
