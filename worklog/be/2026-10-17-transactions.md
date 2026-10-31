# 거래 조회와 판정 대상 포함·제외 (B7)

- 브랜치: feature/transactions-api (feature/upload-batches 위)
- 커밋: 1개
- 주요파일: TransactionService.java, TransactionController.java, TransactionDetail.java, TransactionRecordEntity.java

## 한 일

- `GET /transactions`, `GET /transactions/{id}`, `POST /transactions/{id}/exclude`, `include` 의 목을 실제 처리로 바꿨다. `TransactionMockData` 는 쓰는 곳이 없어져 지웠다.
- 목록 조건(batchId, year, month, status, classificationStatus, verdict)은 모두 AND 다. 정렬은 `approvedAt DESC, id DESC`.
  - `status` 는 effectiveStatus 기준. `TransactionDetail.effectiveStatus` 와 같은 규칙을 SQL 로 풀었다.
  - `verdict` 는 현재 판정 기준(활성 override 우선, 없으면 override 가 아닌 최신 revision).
  - `month` 는 `year` 없이 주면 모든 해의 그 달이다(프론트 목과 같다).
- `include`: 취소상계는 409 `CANCELED_TRANSACTION_NOT_INCLUDABLE`. 미분류인데 대기 중인 분류 검토가 없으면 지금 만든다(B4 에서 업로드가 제외 거래의 검토를 만들지 않기로 해서).
- 포함·제외는 거래 행을 잠그고 바꾼다. 같은 거래에 포함이 동시에 와도 분류 검토가 두 번 생기지 않는다.
- 테스트: `TransactionIntegrationTest` 6(정렬·페이지·소유자, 조건 4종, 현재 판정 기준 verdict, 포함·제외 후 판정 유지, 포함 시 분류 검토 1개, 취소상계 409·남의 거래 404).

## 왜 이렇게 했나

- 목록은 주어진 조건만 붙인 native SQL 이다. 조건이 여섯 개이고 대부분 비어서 오는데, `:x is null or ...` 로 쓰면 Postgres 가 null 파라미터 타입을 못 정하는 경우가 있다(#132 의 42P18).
- 현재 판정 조건을 #132 `JudgmentRepository.findPage` 와 같은 규칙으로 따로 썼다. #132 가 아직 develop 에 없어서 그 쿼리를 부를 수 없다.
- 제외해도 대기 중인 분류 검토는 지우지 않는다. 다시 포함하면 그대로 쓴다.

## 확인한 것

- `./gradlew test integrationTest` 는 작업 환경에서 못 돌렸다(Maven Central·Gradle 배포 서버 차단). 로컬에서 돌려야 한다.

## 남은 것 · 아는 문제

- 판정 대상 조건과 현재 판정 조건이 여러 쿼리에 복사돼 있다(findRunTargetIds, #132 findPage, #135, 이 PR). 스택이 다 들어가면 한 곳으로 모은다.
- 분류 검토 목록(B8)이 제외 거래의 검토를 거를지는 B8 에서 정한다.
