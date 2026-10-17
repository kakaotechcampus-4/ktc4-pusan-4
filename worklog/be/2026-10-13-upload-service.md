# 업로드 서비스를 만든다 (B4)

- 브랜치: feature/upload-service (feature/merchant-classifier 위)
- 커밋: 1개
- 주요파일: UploadService.java, UploadRequestValidator.java, TransactionRecordEntity.java, UploadBatchEntity.java, ClassificationReviewEntity.java

## 한 일

- `transaction/persistence/UploadService.upload(userId, NewUploadBatch)` (docs/backend_api_plan.md B4)
  - 사용자 행 잠금 → fileHash 중복이면 409 `DUPLICATE_FILE` → naturalKey 중복 건너뛰기 → 분류기(B3b) → batch·거래·분류 검토 저장. 한 트랜잭션.
  - 미분류 거래는 `merchant_category = 미분류`, `classification_status = NEEDS_REVIEW` 로 저장하고 `classification_review`(PENDING)를 만든다.
  - 결과는 `UploadResult`(api.md 3.3 응답 201 의 필드).
- `transaction/api/UploadRequestValidator`: 요청 DTO → `NewUploadBatch`. 422 `INVALID_SOURCE_TYPE`·`EMPTY_TRANSACTIONS`·`MISSING_NATURAL_KEY`, 그 밖의 누락·범위 위반은 400 `VALIDATION_ERROR`.
- `UploadBatchEntity`·`TransactionRecordEntity` 를 public 으로 열고 생성자를 더했다. `ClassificationReviewEntity` 신설(PENDING 생성만).
- 엔드포인트는 아직 목이다. Idempotency 없이 공개하면 계약을 어기므로 B5 에서 컨트롤러를 바꾼다.

## 왜 이렇게 했나

- 사용자 행을 `FOR UPDATE` 로 잠근다. 같은 파일을 두 번 동시에 올리면 둘 다 fileHash 를 "없음"으로 보고 INSERT 해 UNIQUE 위반이 500 으로 나간다. naturalKey 도 같다. Context 채번(B1b)과 같은 방식이다.
- 같은 요청 안에서 naturalKey 가 반복되면 뒤의 것을 건너뛰고 `skippedDuplicateCount` 에 센다. 이것도 `UNIQUE(user_id, natural_key)` 에 걸리기 때문이다.
- 거래가 전부 중복이어도 batch 는 만든다(거래 0건). 계약이 "naturalKey 중복은 batch 실패 사유가 아니다"로 정했다.
- 저장은 `EntityManager.persist` 다. id 를 코드가 정하는 엔티티에 Spring Data `save` 를 쓰면 행마다 SELECT(merge)가 나간다.
- `created_at` 을 코드가 채운다(KST). 응답에 바로 써야 하는데 DB 기본값은 INSERT 뒤에 다시 읽어야 보인다.
- 컬럼 길이(file_hash 128, natural_key 128, approval_no 32, biz_no 20, source_card 20)와 `period_end >= period_start`, `installment_months >= 0` 을 검증기에서 막는다. 넘기면 DB 가 500 을 낸다.

## 확인한 것

- 작업 환경에서 Maven Central·Gradle 배포 서버가 막혀 `./gradlew test integrationTest` 를 못 돌렸다. 로컬에서 돌려야 한다.
- 테스트: `UploadRequestValidatorTest`(단위 6), `UploadServiceIntegrationTest`(8: 분류·검토 생성, 선택값 기본값, 기존·요청 내 중복, 타 사용자 같은 키, 전부 중복, 같은 파일 409, 없는 사용자 401, 동시 업로드).

## 남은 것 · 아는 문제

- `CANCELED_OFFSET` 거래도 미분류면 분류 검토를 만든다. 계약 문구대로 했지만 취소상계는 판정에 들어갈 일이 없어 사용자에게 묻는 게 잡음일 수 있다. 팀 확인 필요.
- 분류 결정(10/16)에서 분류를 AI 서버로 옮기면 분류기 호출 부분만 바뀐다.

## 리뷰 반영 (10/17, PR #129)

- 취소상계·대상제외 거래는 미분류여도 분류 검토를 만들지 않는다. 판정에 들어가지 않는 거래를 묻는 건 잡음이라는 리뷰(민규)를 따랐다. 거래는 그대로 NEEDS_REVIEW 로 저장하고, 사용자가 포함(B7)할 때 검토를 만든다.
- api.md 3.3 에 같은 요청 안의 naturalKey 반복 규칙(뒤의 것을 건너뛰고 skippedDuplicateCount 에 센다)을 적었다.
- 승인번호가 빈 행이 실제로 생기는지는 아직 실측하지 못했다. 브라우저 파서 작업 때 확인한다.
