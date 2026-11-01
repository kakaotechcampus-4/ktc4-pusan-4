# 업로드 배치 조회·삭제와 탈퇴 (B6)

- 브랜치: feature/upload-batches (feature/upload-idempotency 위)
- 커밋: 1개
- 주요파일: UploadBatchService.java, UploadBatchCountRepository.java, UserService.java, V13__add_upload_batch_skipped_count.sql

## 한 일

- `GET /upload-batches`, `GET /upload-batches/{id}`, `DELETE /upload-batches/{id}`, `DELETE /users/me` 의 목을 실제 처리로 바꿨다.
- 목록은 `createdAt DESC, id DESC`. 거래 수와 분류 대기 수는 한 페이지의 batch 를 모아 쿼리 한 번씩으로 센다.
- 건너뛴 중복 수는 거래 행이 남지 않아 나중에 셀 수 없으므로 `upload_batch.skipped_duplicate_count`(V13)에 남긴다. B4 업로드가 채운다.
- batch 삭제와 탈퇴는 DELETE 한 줄이고 종속 데이터는 V7 의 CASCADE 가 지운다. 남의 batch 는 404 `BATCH_NOT_FOUND`, 이미 없는 사용자는 401 이다.
- `PageResponse.of(Page)` 를 #127 과 같은 코드로 더했다(머지 때 같은 줄이라 충돌하지 않는다).
- 테스트: `UploadBatchIntegrationTest` 5(목록 순서·건수, 분류 대기 수가 조회 시점 값, 남의 batch, batch 삭제 후 다른 batch·Idempotency-Key 유지, 탈퇴).

## 왜 이렇게 했나

- 거래 수와 분류 대기 수를 컬럼으로 두지 않았다. 분류 대기 수는 B8 에서 답할 때마다 바뀌어서, 컬럼이면 두 곳을 같이 고쳐야 한다.
- 삭제를 엔티티를 읽어 지우지 않고 JPQL DELETE 로 했다. 소유자 조건을 같은 문장에 넣어 확인과 삭제 사이에 틈이 없다.
- 연쇄 삭제의 표 단위 검사는 `JudgmentSchemaIntegrationTest` 가 이미 SQL 로 한다. 여기서는 서비스를 거쳐 판정·질문·답변·수정이 붙은 batch 가 지워지는지만 본다.

## 확인한 것

- `./gradlew test integrationTest` 는 작업 환경에서 못 돌렸다(Maven Central·Gradle 배포 서버 차단). 로컬에서 돌려야 한다.

## 남은 것 · 아는 문제

- 마이그레이션 번호 V13: V11(#128)·V12(#130)가 먼저 머지돼야 한다.
- 지금은 임시 사용자 하나라, 로컬에서 `DELETE /users/me` 를 부르면 서버를 다시 띄울 때까지 모든 API 가 401 이다. B9b 에서 인증이 붙으면 사라진다.
- 판정이 돌고 있는 batch 를 지우면 실행기가 사라진 run 을 만난다. api.md 에 막는 에러가 없어 막지 않았다.
