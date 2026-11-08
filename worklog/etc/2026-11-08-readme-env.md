# README 환경 변수 절 작성

- 브랜치: feature/readme
- 커밋: 5e1e80a8 (1개)
- 주요파일: README.md

## 한 일

- PR #257 에서 비워 둔 「실행 · 배포 > 환경 변수」 칸을 채웠다.
- 로컬(`.env`, 예시 `.env.example`)과 운영(`/etc/ktc4/production.env`, 예시 `deploy/production.env.example`)이 읽는 파일을 표로 나눴다.
- 로컬 compose 기본값(`DB_*` ktc4 / ktc4-local / 15432, `REDIS_PORT` 16379, `AI_PORT` 8000)을 표로 적었다.
- Backend · AI · Frontend 가 환경 변수를 받는 방식을 한 줄씩 적었다.

## 왜 이렇게 했나

- 칸을 만들 때는 파트별 표가 없었는데, 이후 Backend · AI 실행 절에 항목별 표가 들어왔다. 그래서 이 칸은 항목을 되풀이하지 않고 파트를 아우르는 내용(어느 파일을 누가 읽는지)만 맡겼다.
- 로컬에서 `bootRun` 으로 띄운 백엔드는 `.env` 를 읽지 않는다. `application-local.yml` 기본값이 compose 기본값과 같아서 붙는 것이라, compose 쪽 값을 직접 적어 둬야 이 관계가 보인다.
- Frontend 는 `.env` 가 아니라 빌드할 때 들어가는 `VITE_*` 를 쓴다. 운영은 `deploy/web.Dockerfile` 이 `VITE_API=http` 로 빌드하고 카카오 키는 GitHub variable 로 넘긴다.

## 남은 것 · 아는 문제

- `docs/deployment.md` 27행은 "지금 web 이미지는 목업 빌드"라고 하는데 `deploy/web.Dockerfile` 은 이미 `VITE_API=http` 로 빌드한다. 이 PR 범위 밖이라 고치지 않았다.

## 00:48 항목별 설명 안내에 Frontend 절 추가

- 커밋: 9def336f
- 마지막 문장을 "[Backend], [Frontend], [AI] 절에 정리되어 있습니다" 로 바꿨다. Frontend 실행 칸도 곧 채워질 예정이라 함께 가리킨다.
- Frontend 칸에 표가 들어올지 몰라 "표" 대신 "절" 이라고 썼다.
