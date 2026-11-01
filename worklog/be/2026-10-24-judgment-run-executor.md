# 판정 run 을 전용 스레드 풀(워커 4, 대기열 150)에서 실행한다

- 브랜치: refactor/judgment-run-executor
- 커밋: 770f994 (1개)
- 주요파일: JudgmentRunExecutorConfiguration.java, JudgmentRunner.java, JudgmentRunService.java

## 한 일

- `JudgmentRunExecutorConfiguration` 에 판정 run 전용 `ThreadPoolTaskExecutor`(`judgmentRunExecutor`)를 뒀다. 워커 4(core = max), 대기열 150, 스레드 이름 `judgment-run-`
- `JudgmentRunner.onCreated` 에서 `@Async` 를 빼고, `@TransactionalEventListener` 안에서 풀에 직접 넘긴다. `TaskRejectedException` 이면 `runService.fail` 로 run 을 `RUN_START_FAILED` 로 끝낸다
- `JudgmentRunService.fail` 을 `REQUIRES_NEW` 로 바꿨다
- 쓰이지 않게 된 `shared/AsyncConfiguration`(`@EnableAsync`)을 지웠다
- `JudgmentRunRejectionIntegrationTest`: 풀이 거절하면 run 생성은 성공하고 그 run 이 `FAILED`, 항목이 `RUN_START_FAILED` 로 남는다. `REQUIRES_NEW` 를 `REQUIRED` 로 되돌리면 run 이 `QUEUED` 로 남아 실패하는 것을 확인했다
- `docs/architecture.md` 판정 실행(run) 절에 전용 풀과 대기열이 찼을 때를 적고, `docs/api.md` `RUN_START_FAILED` 설명에 "판정 대기열이 가득 참" 을 더했다

## 왜 이렇게 했나

- 워커 4: 같은 Docker 네트워크에서 run 8개 × 1,200건을 동시에 만들어 Spring Boot 기본 풀 크기를 1·2·4·8 로 바꿔 쟀다. 처리량이 185 → 375 → 562 → 829 건/초(1 대비 2.0·3.0·4.5배)였다. 8 은 덜 늘고 DB 커넥션 10개 중 8개를 차지한다. 진행률 GET 은 8 에서도 최대 41ms 였다(폴링 클라이언트 하나)
- 대기열 150: 멈춘 run 정리(`interruptStale`)가 QUEUED 도 진행 없음 5분이면 끝낸다. 1,200건 run 하나가 약 8초라 150 × 8초 / 4 ≈ 5분이다
- 풀에 직접 넘긴 이유: `@Async` 는 대기열이 찼을 때 `TaskRejectedException` 을 run 을 만든 요청의 커밋 뒤(afterCommit)에 그 요청 스레드로 던진다. run 은 저장됐는데 응답이 500 이 된다
- `REQUIRES_NEW`: AFTER_COMMIT 리스너 안에서 `REQUIRED` 로 들어가면 이미 끝난 트랜잭션에 참여해 바꾼 내용이 커밋되지 않는다. `fail` 을 부르는 다른 곳(실행 스레드, 테스트)은 바깥 트랜잭션이 없어 동작이 같다
- 새 에러 코드 대신 `RUN_START_FAILED` 를 썼다. "Run 을 시작하지 못했다" 는 뜻이 같다

## 남은 것 · 아는 문제

- 측정은 개발 PC(Docker Desktop) 값이다. EC2 에서 처리량과 워커 4 의 효과는 재지 않았다
- 사용자 여럿이 동시에 폴링하는 부하는 재지 않았다
- 종료할 때 진행 중인 run 을 기다리는 설정(graceful shutdown)은 다음 브랜치에서 한다

## 03:33 풀 크기를 설정으로 빼고 운영·개발 값을 나눈다

- 커밋: dade4be (1개)

### 한 일

- `JudgmentRunExecutorConfiguration` 이 워커·대기열을 `app.judgment-run.workers`, `app.judgment-run.queue-capacity` 에서 읽는다
- 운영(`application.yml`)은 워커 2, 대기열 50. 로컬 개발(`application-local.yml`)은 워커 4, 대기열 150. 근거를 각 설정 파일 주석에 적었다
- `docs/architecture.md` 판정 실행(run) 절을 설정 기반으로 고쳤다

### 왜 이렇게 했나

- 앞 기록의 워커 4·대기열 150 은 개발 PC(Docker Desktop, CPU 22개) 측정이라 운영에 그대로 쓸 수 없었다(사용자 지적). 운영은 EC2 t3.medium 한 대(2 vCPU, 4GB)에 DB·AI·웹이 함께 뜬다(`worklog/etc/2026-09-26-aws-release.md`)
- 운영 값은 백엔드·Postgres 컨테이너에 CPU 를 1개씩(`--cpus=1`) 주고 같은 부하(run 8개 × 1,200건)로 쟀다. 처리량이 워커 1개 157, 2개 254(1.6배), 4개 265건/초(1.7배)였고, 4개는 진행률 GET 이 최대 175ms(2개는 84ms)로 느려졌다
- 대기열 50: 워커 하나가 초당 약 127건이라 1,200건 run 이 약 9.4초, 5분 안에 맨 뒤 run 이 시작되는 상한이 약 64 다
- 개발 값은 `application-local.yml` 에, 운영 값은 기본인 `application.yml` 에 뒀다. 테스트는 프로필 없이 돌아 운영 값을 쓴다

### 남은 것 · 아는 문제

- CPU 제한 측정은 EBS fsync 와 t3 CPU 크레딧(버스트)을 반영하지 않는다. 실제 EC2 는 더 느릴 수 있다
- 운영 값에서 1,200건 run 100개가 몰리면(12만 건, 약 7.9분) 대기열 50 을 넘는 run 은 RUN_START_FAILED 로 끝난다
- 로컬 프로필에서 4·150 이 실제로 적용되는지는 앱을 띄워 확인하지 않았다

## 03:50 배포로 종료할 때 판정 run 을 60초까지 마저 처리한다

- 브랜치: refactor/judgment-run-graceful-shutdown (refactor/judgment-run-executor 위)
- 커밋: fa4fcbc (1개)

### 한 일

- `judgmentRunExecutor` 에 `waitForTasksToCompleteOnShutdown(true)` 와 `app.judgment-run.await-termination`(운영 60s)을 줬다
- `deploy/compose.yaml` 백엔드에 `stop_grace_period: 90s` 를 줬다
- `docs/architecture.md` 에 정상 종료 때의 동작과 DB 대기열을 쓰지 않는 이유를, `docs/deployment.md` 4절에 배포 중 백엔드가 멈춰 있는 시간이 길어지는 것을 적었다

### 왜 이렇게 했나

- run 도중 컨테이너에 SIGTERM 을 보내 설정 전후를 비교했다(백엔드·Postgres 에 CPU 1개씩, `docker stop -t 120~150`)
  - 3,000건 run 1개, 4개(워커 2 실행 + 대기열 2): 설정이 없어도 Spring 6.1 의 실행기 종료 처리가 돌던 run 과 대기열의 run 을 기다려 모두 COMPLETED 였다. 커넥션 풀은 그 뒤에 닫혔다
  - 6,000건 run 1개(약 47초): 설정이 없으면 30초 뒤 `Shutdown phase ... ends with 1 bean still running after timeout of 30000ms: [judgmentRunExecutor]` 를 남기고 커넥션 풀을 닫아 RUNNING 3823/6000 으로 남았다. 설정을 넣으니 43.9초 만에 COMPLETED 로 끝나고 커넥션 풀이 그 뒤에 닫혔다
- 60s: 같은 조건에서 3,000건 run 약 28초, 6,000건 약 47초다
- 90s: 웹 요청 종료 대기(`spring.lifecycle.timeout-per-shutdown-phase`, 최대 30s)까지 더했다
- 중간에 죽는 것은 치명적이지 않다고 봤다(사용자 결정). 판정은 다시 돌리면 같은 결과가 나오고 append-only 라 DB 대기열 대신 지금의 멈춘 run 정리(#128)로 둔다

### 남은 것 · 아는 문제

- 종료 동작은 자동 테스트가 없다. 측정용 스크립트로 직접 확인했다
- 판정이 도는 중에 배포하면 새 백엔드가 뜨기 전까지 멈춰 있는 시간이 최대 60초 늘어난다
- 60초 안에 못 끝낸 run 은 새 서버의 정리가 5분 뒤 RUN_INTERRUPTED 로 끝낸다
