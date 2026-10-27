# Idempotency-Key 를 구현하고 업로드를 공개한다 (B5)

- 브랜치: feature/upload-idempotency (feature/upload-service 위)
- 커밋: 1개
- 주요파일: V12__create_idempotency_key.sql, IdempotencyKeyEntity.java, UploadService.java, UploadBatchController.java

## 한 일

- `idempotency_key` 테이블(V12): `UNIQUE(user_id, idempotency_key)`, 요청 해시, 최초 응답(batch_id + 건수 3개 + createdAt), `expires_at`.
- `UploadService.upload(userId, idempotencyKey, input)`: 사용자 잠금 → 키 조회
  - 유효 + 다른 payload → 409 `IDEMPOTENCY_KEY_REUSED`
  - 유효 + 같은 payload + batch 삭제됨 → 410 `IDEMPOTENCY_RESULT_DELETED`
  - 유효 + 같은 payload → 최초 응답 그대로(201)
  - 없음·만료 → 업로드(B4) 후 같은 트랜잭션에서 키에 응답 기록. 만료된 키는 같은 행에 덮어쓴다.
- `POST /api/v1/upload-batches` 목 제거. 검증기(B4) → 서비스. 키 128자 초과는 400 `VALIDATION_ERROR`.
- 테스트: `UploadIdempotencyIntegrationTest` 10(201, 재전송, 필드 순서 무관, 409, 410, 만료 후 fileHash 규칙, 만료 키 재사용, 400, 검증 실패 시 키 미저장, 동시 요청).

## 왜 이렇게 했나

- 삭제 상태를 컬럼으로 두지 않고 `batch_id ... ON DELETE SET NULL` 로 둔다. batch 가 지워지면 DB 가 알아서 DELETED 가 되므로 B6 삭제 코드가 키를 신경 쓰지 않아도 된다.
- 키 조회를 사용자 잠금 뒤에 한다. 같은 키 동시 요청에서 뒤의 것은 앞의 것이 커밋한 행을 보고 재전송 응답을 받는다(batch 1개).
- 요청 해시는 원문 JSON 이 아니라 파싱한 값을 다시 직렬화해 만든다. 키 순서·공백이 달라도 같은 요청이다.
- 만료된 키를 지우고 새로 넣지 않고 같은 행을 덮어쓴다. Hibernate 는 INSERT 를 DELETE 보다 먼저 내보내서 UNIQUE 에 걸린다.
- createdAt 을 마이크로초로 자른다. DB 를 거친 재전송 응답이 최초 응답과 글자까지 같아야 한다.
- Redis 가 아니라 DB 다. 업로드 저장과 같은 트랜잭션이어야 "업로드는 됐는데 키는 없음"이 안 생긴다(api.md 는 저장소를 구현 세부로 둠).

## 확인한 것

- 로컬 Postgres 16 에 V1~V8·V10·V12 적용. UNIQUE·CHECK, batch 삭제 시 거래·분류 검토 연쇄 삭제 + 키 `batch_id` NULL, 테스트의 만료 SQL 이 CHECK 를 지키는 것 확인.
- 의존성 없이 javac 로 전체 소스 파싱·프로젝트 내부 심볼 확인. `./gradlew test integrationTest` 는 작업 환경에서 못 돌렸다(Maven Central 차단). 로컬에서 돌려야 한다.

## 남은 것 · 아는 문제

- 마이그레이션 번호 V12: V11 은 열린 PR #128 이 쓴다. #128 이 먼저 머지돼야 하고, 반대 순서면 둘 중 하나를 다시 매겨야 한다.
- 만료된 키 행을 지우는 작업은 없다. 쌓이기만 하므로 정리 배치가 필요해지면 따로 만든다.

## 리뷰 반영 (10/17, PR #130)

- V12 `batch_id` 컬럼에 "NULL 이면 삭제된 batch, 410" 주석을 달았다(민규 리뷰).
