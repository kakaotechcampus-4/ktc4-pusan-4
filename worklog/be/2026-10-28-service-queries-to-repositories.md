# 서비스가 직접 쓰던 EntityManager 쿼리·persist 를 Repository 로 옮긴다

- 브랜치: refactor/service-queries-to-repositories
- 커밋: c015813 (1개)
- 주요파일: UploadService.java, UserWriteLock.java, UploadBatchRepository.java, AssignedIdEntity.java

## 한 일

- `UploadService`, `TransactionService`, `RuleCandidatePersistenceService` 의 `entityManager.persist`·`flush` 를 Repository 의 `save`·`saveAndFlush` 로 바꿨다. 이를 위해 `RuleCandidateRepository` 를 새로 만들었다.
- `UserWriteLock` 의 네이티브 잠금 쿼리를 `UploadBatchRepository.lockUserForWrite` 로 옮겼다. SQL 은 그대로 `for update` 다.
- id 를 직접 채우는 엔티티 넷(`UploadBatchEntity`, `TransactionRecordEntity`, `IdempotencyKeyEntity`, `ClassificationReviewEntity`)이 `AssignedIdEntity` 를 상속한다. 다른 패키지에서도 쓰도록 `AssignedIdEntity` 를 public 으로 바꿨다.

## 왜 이렇게 했나

- 서비스에는 쿼리나 EntityManager 를 두지 않고 Repository 를 거친다는 팀 규칙에 맞췄다.
- `save()` 는 id 가 이미 있으면 기존 행으로 보고 merge 한다. 그래서 INSERT 전에 SELECT 가 한 번 더 나간다. 업로드는 거래마다 INSERT 하므로 그대로 두면 문장 수가 크게 는다. 이미 판정·질문 엔티티가 쓰는 `AssignedIdEntity`(Persistable)를 붙여 새 객체는 바로 INSERT 하게 했다.
- 한도 항목(`LimitBucketPersistenceService`)은 #184 에서 옮겼다. #184 가 `LimitBucketEntryRepository` 를 새로 만들어서, 여기서도 만들면 같은 파일을 두 PR 이 추가하는 충돌이 난다.
- `TemporaryUserSeeder` 의 `JdbcTemplate` 는 두었다. B9b(#176, #177)가 이 파일을 지운다.

## 확인한 것

- `gradlew -p backend check` 통과(unit 360, integration 150).
- Hibernate SQL 로그를 켜고 업로드·Idempotency·거래 통합 테스트를 develop 과 이 브랜치에서 돌렸다. 나간 문장의 종류와 수가 같았다. INSERT 전 SELECT 가 늘지 않았다.

## 남은 것 · 아는 문제

- #156, #158 이 `ClassificationReviewRepository`·`ClassificationReviewEntity`·`TransactionRecordEntity` 를 함께 고친다. 나중에 머지하는 쪽에서 충돌을 풀어야 한다. 서로 다른 메서드를 더한 것이라 둘 다 살리면 된다.
