# 백엔드 로깅·모니터링 구현 계획

- 브랜치: feature/monitoring-plan
- 커밋: 950af21 (1개)
- 주요파일: docs/monitoring_plan.md

## 한 일

- 11/6 v1.0 배포까지 백엔드 로그·지표를 CloudWatch 에 모으고 Discord 로 알리는 계획을 `docs/monitoring_plan.md` 에 썼다.
- 2명이 나눠 하도록 트랙 A(백엔드·compose: A1 요청 추적·구조화 로그, A2 Prometheus 엔드포인트, A3 compose 로그 드라이버)와 트랙 B(AWS: B1 스택·Discord 알림, B2 CloudWatch Agent, B3 필터·알람·대시보드)로 PR 을 나눴다.
- 트랙이 동시에 갈 수 있게 로그 그룹 이름, 로그 형식, 지표 엔드포인트 같은 계약 값과 꼭 지켜야 할 순서를 표로 고정했다.

## 왜 이렇게 했나

- 2026-11-02 `ktc-team` SSO 로 확인해 보니 EC2 역할 `ktc-ec2-ssm-role` 에 `CloudWatchAgentServerPolicy` 가 이미 있다. 서울 리전에서 Logs·지표·알람·Lambda 권한도 시뮬레이션상 allowed 였다. 그래서 별도 권한 요청 없이 CloudWatch 로 간다. SCP 가 서울 밖을 막는다.
- Prometheus·Grafana 를 서버에 직접 올리는 안은 메모리(4GB 중 컨테이너 한도 합 약 3.1GB) 때문에 뺐다. Grafana Cloud 는 외부 계정, 사용자 3명 한도, `docker.sock` 마운트 때문에 뺐다. Prometheus 형식 엔드포인트만 열고 CloudWatch Agent 가 긁는다.
- 관리 포트 8081 분리는 compose healthcheck 와 actuator 통합 테스트 2개를 같이 고쳐야 해서 하지 않는다. Caddy 가 `/api/v1/*` 만 넘기므로 8080 을 `127.0.0.1` 에만 연다.
- `awslogs` 드라이버는 로그 그룹이 없으면 컨테이너가 안 뜬다. 그래서 B1 스택 배포를 A3 release 보다 먼저 하도록 순서에 넣었다.

## 남은 것 · 아는 문제

- 로그 보존 14일, 알람 임계값, 배포 재시작 알림, Discord 장애 스레드 분리는 제안값이다. 각 PR 리뷰에서 정한다.
- SSO 역할의 CloudFormation·Lambda·IAM 권한은 시뮬레이션만 했다. 실제 배포는 B1 에서 확인한다.
- Prometheus counter 를 CloudWatch 로 옮기는 변환은 확인하지 않아, 건수는 로그 메트릭 필터로 센다.
