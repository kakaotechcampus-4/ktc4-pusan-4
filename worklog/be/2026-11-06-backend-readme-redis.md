# backend README 로컬 실행에 Redis 추가

- 브랜치: feature/backend-readme-redis
- 주요파일: backend/README.md

## 한 일

- 로컬 실행 명령을 `docker compose up -d postgres` 에서 `docker compose up -d postgres redis` 로 바꿨다.
- health 설명에 Redis 는 검사에서 빠져 있어 없어도 UP 으로 나온다는 문장을 더했다.
- `local` 프로필 기본 연결값 표에 `REDIS_HOST`(localhost)·`REDIS_PORT`(16379)를 더했다(`application-local.yml`, 루트 `compose.yaml`).

## 왜 이렇게 했나

- 로그인 때 리프레시 토큰을 Redis 에 저장한다(`RedisRefreshTokenStore`). README 대로 postgres 만 띄우면 health 는 UP 인데 로그인이 실패해 원인을 찾기 어렵다.
- 팀 문서 사이트(#258) 로컬 실행 탭이 이 README 를 옮겨 같은 문제가 있어, 원본부터 고쳤다.
