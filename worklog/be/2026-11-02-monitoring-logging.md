# 로깅·모니터링 트랙 A: 요청 추적·JSON 로그, Prometheus 엔드포인트, compose 로그 드라이버

- 브랜치: feature/monitoring-logging (origin/develop 886b652 에서 시작)
- 커밋: 581a3af..a64c097 (3개)
- 주요파일: RequestTraceFilter.java, application.yml, deploy/compose.yaml, docs/deployment.md

## 한 일

- A1: `RequestTraceFilter` 가 요청마다 traceId 를 MDC·응답 헤더 `X-Trace-Id` 에 넣고, 끝나면 요청 로그 한 줄(`method`, `path`, `status`, `durationMs`)을 남긴다. `ApiExceptionHandler` 는 새 UUID 대신 그 traceId 를 에러 본문에 쓴다. 인증 인터셉터가 MDC `userId`, 판정 run 워커가 MDC `runId` 를 넣는다. 운영은 logstash JSON, local 프로필은 텍스트.
- A2: `micrometer-registry-prometheus` 를 넣고 `/actuator/prometheus` 를 열었다. compose 의 backend 8080 을 `127.0.0.1` 에만 연다.
- A3: backend 는 `awslogs`(`/ktc4/backend`, 그룹 자동 생성 끔, non-blocking), 나머지 4개는 `json-file` 10MB × 5. `docs/deployment.md` 13절 "로그" 를 썼다.

## 왜 이렇게 했나

- 트랙 A 3개를 PR 하나로 합쳤다(사용자 지시). 커밋은 A1·A2·A3 로 나눠 따로 볼 수 있게 했다.
- 요청 로그 필드는 MDC(문자열) 대신 SLF4J key-value 로 넣었다. CloudWatch 필터 `{ $.status >= 500 }` 는 숫자 필드여야 걸린다. 메시지에도 같은 값을 넣어 로컬 텍스트 로그에서도 읽힌다.
- `/actuator` 는 요청 로그에서 뺐다. healthcheck(15초)와 Agent 수집(60초)이 하루 약 7,000줄을 만든다. 계획서의 "요청마다 한 줄" 에서 벗어나는 내 제안이라 PR 에 적었다.
- userId 는 인터셉터가 사용자를 확인한 직후 MDC 에 넣는다. 요청 로그뿐 아니라 그 요청의 에러 로그에도 붙는다. 지우는 것은 필터 한 곳이다.
- 에러 본문 traceId 는 MDC 가 비면 예전처럼 새로 만든다. 필터 없이 만든 MockMvc(`AuthIntegrationTest`, `KakaoLoginIntegrationTest`)가 traceId 가 있는지 본다.
- Spring Boot 테스트는 지표 내보내기를 기본으로 꺼서, prometheus 통합 테스트에 `@AutoConfigureObservability(tracing = false)` 를 붙였다.

## 확인한 것

- 새 테스트를 구현 전에 돌려 4개 실패를 봤고, 구현 뒤 통과했다(`RequestTraceFilterTest` 3, `JudgmentRunnerTest` 1). prometheus 테스트는 observability 없이 404 로 실패한 뒤 통과했다.
- `gradlew -p backend check` 통과(unit 413, integration 280, 4개 건너뜀). 다른 브랜치에서 남은 추적 안 된 벤치마크 테스트 2개가 작업 트리에 있어 함께 돌았다.
- 기본 프로필로 로컬에서 띄워 실제 JSON 로그를 받았다(401 요청, postgres 를 멈춘 500 요청, 기동). `aws logs test-metric-filter` 로 B3 의 두 필터를 그 세 줄에 돌려 5xx 필터는 500 줄만, 기동 필터는 기동 줄만 걸리는 것을 봤다.
- `/actuator/prometheus` 는 기동 직후 요청 하나 뒤 108줄(시계열). 대시보드 3개 이름: `hikaricp_connections_pending{pool="HikariPool-1"}`, `jvm_memory_used_bytes{area="heap",id=...}` 3개(Eden·Old·Survivor), `executor_queued_tasks{name="judgmentRunExecutor"}`. B2 의 relabel 규칙과 맞는다.
- local 프로필은 텍스트 로그로 나오는 것을 봤다. `docker compose -f deploy/compose.yaml config` 통과.

## 남은 것 · 아는 문제

- release 조건: B1 스택(로그 그룹 `/ktc4/backend`)이 먼저 배포돼 있어야 한다. 없으면 백엔드가 뜨지 않는다.
- 운영 확인은 release 뒤에 한다: CloudWatch 에 로그가 오는지, Logs Insights 에서 traceId 로 요청을 찾는지, `docker logs` 가 되는지.
- `docs/deployment.md` 13절은 B1(#222)도 자리만 만들어 둬서, 뒤에 merge 하는 쪽이 충돌을 풀어야 한다. 이 PR 의 내용을 남기면 된다.
- 판정 run 워커 로그에는 traceId 가 없다(run 을 만든 요청과는 runId 로 잇는다).

## 23:50 실패한 actuator 요청은 요청 로그에 남긴다

- 커밋: f8dcfdb (1개)
- `/actuator` 를 요청 로그에서 통째로 빼던 것을, 2xx 만 빼고 나머지는 남기도록 바꿨다(사용자 결정).

### 왜 이렇게 했나

- actuator 가 5xx 를 내는 경우는 사실상 DB 연결 불가(health 503) 하나이고, 이건 거의 모든 API 가 죽은 상태다.
- 사용자 요청이 있으면 그 요청의 500 으로 5xx 알람이 울린다. 요청이 없는 시간에는 프로세스가 살아 있어 재시작 알람도 없고, Docker 는 unhealthy 컨테이너를 재시작하지 않는다. 그래서 health 503 이 5xx 알람을 울리는 유일한 신호다.
- 다른 안으로 B3 에 ERROR 레벨 메트릭 필터를 더하는 것이 있다. HTTP 밖의 오류까지 잡지만 B 트랙 몫이라 B3 리뷰에서 제안하기로 했다.

### 확인한 것

- 새 테스트를 먼저 돌려 실패를 본 뒤 고쳤다. unit 414 통과.
- 기본 프로필로 띄우고 postgres 를 멈춰 health 를 불렀다. 30초 뒤 503 이고 `GET /actuator/health 503 30029ms` 가 `status:503` 으로 남았다. 성공한 200 은 남지 않았다.
- DB 가 약 80초 끊겨 있는 동안 스케줄러(`interruptStale`)의 ERROR 로그는 나오지 않았다(Hikari WARN 만). 앞서 스케줄러가 ERROR 를 남길 것으로 본 추론은 이 시간 안에서는 맞지 않았다.
