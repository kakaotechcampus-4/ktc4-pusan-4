# 같은 업로드에 진행 중인 판정 실행이 있으면 409 로 막는다 (#191, #187)

- 브랜치: fix/run-active-conflict (develop eebd836 에서 시작)
- 커밋: f51c765 (1개)
- 주요파일: JudgmentRunService.java, JudgmentRunRepository.java, ErrorResponse.java, docs/api.md

## 한 일

- `JudgmentRunService.create` 가 사용자 락을 잡고 같은 batch 의 QUEUED·RUNNING run 중 마지막 진행이 5분 안인 것을 찾는다. 있으면 `409 RUN_ALREADY_ACTIVE`.
- `ErrorResponse` 에 `runId` 를 더했다. 값이 있을 때만 나간다(`@JsonInclude(NON_NULL)`). `ApiException` 에 runId 를 받는 생성자를 더했다.
- `api.md` 1.3·3.6, `docs/architecture.md` 판정 실행 절, 컨트롤러 OpenAPI 409 설명을 적었다.

## 왜 이렇게 했나

- 끝난 run 뒤 재실행은 `/run` 의 "다시 판정하기"가 써서 막지 않는다(#191 Jaeseong22 댓글). 동의 여부 값은 받지 않는다(#187·#191: 클라이언트가 true 를 보내면 그만).
- #187 제안의 부분 유니크 인덱스 대신 락 + 조회를 썼다. 인덱스에는 "5분 넘게 진행 없는 run 은 뺀다" 시간 조건을 넣을 수 없고, 버그로 운영에 이미 겹친 run 이 있으면 마이그레이션이 실패해 배포가 막힌다. 조회 방식이라 #187 이 받아들이기로 했던 "서버가 죽으면 최대 6분 다시 판정 불가" 도 생기지 않는다.
- 409 본문에 runId 를 싣는 것은 #187 제안대로다. 서버에 batch 의 현재 run 을 묻는 API 가 없어 FE 가 진행 중인 run 으로 가려면 id 가 필요하다.

## 확인한 것

- 판정 실행기를 목으로 두어 run 이 QUEUED 로 남게 한 통합 테스트(`JudgmentRunActiveConflictIntegrationTest`): 진행 중 409·runId, 끝난 run·멈춘 run 은 통과. 409 와 runId 는 실패를 본 뒤 구현했고, 끝난·멈춘 run 테스트는 처음부터 초록이라 멈춘 run 조건을 일부러 빼 실패하는 것을 보고 되돌렸다.
- `ApiResponseContractTest`: 409 본문 runId, 다른 에러에는 runId 없음.
- `gradlew -p backend check` 통과(unit 410, integration 282, 건너뜀 4 은 벤치마크).

## 남은 것 · 아는 문제

- FE: 409 `RUN_ALREADY_ACTIVE` 를 받으면 `/run/{runId}` 로 이동(#187 3단계). 지금은 일반 실패 문구가 뜬다.
- 진행 중 판단은 사용자 락을 잡는다. 같은 사용자의 질문 답변·한도 집계와 잠깐 차례를 기다릴 수 있다. run 생성은 짧아 문제로 보지 않았고 재지는 않았다.
