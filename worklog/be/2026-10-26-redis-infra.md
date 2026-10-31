# Redis 를 /actuator/health 에서 뺀다 (#166 리뷰 반영)

- 브랜치: feature/redis-infra
- 커밋: 8aa9a7e
- 주요파일: application.yml, BackendApplicationIntegrationTest.java, RedisTestContainer.java, deployment.md

## 한 일

- `management.health.redis.enabled: false`. 백엔드 `/actuator/health` 가 Redis 연결을 보지 않는다.
- `BackendApplicationIntegrationTest` 에서 Redis 컨테이너를 뗐다. Redis 없이 health 가 UP 인지가 그대로 이 설정의 검사가 된다.
- deployment.md 8절 문구와 `RedisTestContainer` 주석을 고쳤다.

## 왜 이렇게 했나

- 유렬 리뷰(#166): Redis 는 리프레시 토큰만 맡는데, Redis 문제로 백엔드가 unhealthy 가 되면 배포가 멈추고 백엔드에 기대는 다른 앱까지 영향을 받는다. Redis 장애는 로그인·재발급 실패로만 드러나게 한다.
- compose 의 `depends_on: redis (service_healthy)` 는 그대로 둔다. 기동 순서만 정하고, 뜬 뒤의 Redis 장애가 백엔드 health 로 번지지 않는다.

## 확인한 것

- 이 커밋 시점에는 이 환경에서 Gradle 을 돌리지 못했다. 로컬 `gradlew -p backend check` 결과는 아래에 이어 쓴다.
