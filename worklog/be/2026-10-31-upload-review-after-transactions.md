# 업로드에서 분류 검토를 거래 저장 뒤에 한꺼번에 저장한다 (#172 후속)

- 브랜치: refactor/upload-review-after-transactions (base: refactor/service-queries-to-repositories, #186)
- 주요파일: UploadService.java

## 한 일

- `UploadService.store` 가 거래를 저장하면서 미분류 거래마다 분류 검토를 바로 저장하던 것을, 검토를 목록에 모아 두었다가 거래를 다 저장한 뒤 저장하도록 바꿨다.
- 응답의 `pendingReviewCount` 는 따로 세던 `pending` 대신 모은 검토 수로 낸다. 값은 같다.

## 왜 이렇게 했나

- #172 가 `hibernate.jdbc.batch_size` 를 켰는데, 같은 테이블 insert 가 이어질 때만 묶인다. 거래 → 검토 → 거래 → 검토로 번갈아 나가면 테이블이 바뀔 때마다 배치가 끊겨 미분류가 많은 업로드일수록 묶이지 않는다.
- `order_inserts` 로 Hibernate 가 정렬하게 하지 않은 이유는 #172 와 같다(연관관계 매핑이 없어 FK 순서를 모른다). 코드에서 거래(부모)를 먼저 다 저장하므로 FK 순서도 지켜진다.

## 확인한 것

- 이 환경에서는 Gradle 을 돌리지 못했다(Maven 저장소 차단). 로컬 `gradlew -p backend check` 결과는 아래에 이어 쓴다.
- 업로드 응답·검토 생성 조건은 그대로라 `UploadServiceIntegrationTest`·`ClassificationReviewIntegrationTest` 가 그대로 덮는다.

## 남은 것 · 아는 문제

- 배치 효과는 #172 설정이 들어가야 나타난다.
- #209 가 같은 반복문에 모델 답(`merchant_model_decision`) 저장을 더한다. 둘 중 나중에 들어가는 쪽이 모델 답도 같은 방식(모아 두었다가 거래 뒤에 저장)으로 맞춘다.
