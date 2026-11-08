# 진행 중인 판정 실행을 사용자 기준으로 막고, 진행 중 실행 조회를 연다

- 브랜치: fix/run-active-return
- 커밋: 69ba0d7b (1개)
- 주요파일: JudgmentRunService.java, JudgmentRunRepository.java, JudgmentRunController.java

## 한 일

11/8 QA 중 성진 몫 3건(새로고침/이동 뒤 동의부터 다시, 진행 화면으로 돌아올 길 없음, 판정 중 또 시작 가능)의 BE 부분.

- `POST /judgment-runs` 의 409 `RUN_ALREADY_ACTIVE` 를 batch 가 아니라 사용자 기준으로 본다. 업로드가 달라도 진행 중인 run 이 있으면 막고, 본문 `runId` 는 그 run 이다.
- `GET /judgment-runs/active`: 이 사용자의 QUEUED, RUNNING run. 있으면 200(상태 조회와 같은 본문), 없으면 204.
- 리포지토리의 `findActiveIds(batchId)` 를 `findActiveForUser(userId)` 로 바꿨다. 새로 만든 것부터 준다.
- api.md 3.6, architecture.md 의 규칙 문장을 고쳤다.

## 왜 이렇게 했나

- 같은 파일을 다시 올리면 batch 가 새로 생겨 #228 의 batch 기준으로는 막히지 않았다. 판정 중이면 다른 판정도 못 하게 하자고 정했다(성진).
- 화면이 진행 중인 run 을 알 길이 진행 화면 주소뿐이라, 떠나면 돌아갈 수 없었다. 조회 API 하나로 FE 의 우회와 띠, 시작 막기를 같이 푼다.
- 검사 기준(5분 무진행 제외)은 409 와 같은 메서드를 쓴다. create 는 이미 사용자 락을 잡고 있어 기준을 사용자로 바꿔도 경쟁이 생기지 않는다.
- 이 규칙 전에 겹쳐 만든 run 이 남아 있을 수 있어 active 는 목록에서 가장 새것을 준다.

## 확인

- `JudgmentRunActiveConflictIntegrationTest` 에 4건 추가: 다른 batch 도 막힘, 다른 사용자는 안 막힘, active 가 내 run 만 줌, 끝났거나 멈춘 run 은 active 가 아님.
- 클라우드 세션에서 Maven Central 이 막혀 BE 빌드와 테스트를 돌리지 못했다. 로컬에서 돌려야 한다.
