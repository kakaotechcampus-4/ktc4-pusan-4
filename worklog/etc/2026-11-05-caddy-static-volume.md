# 배포마다 Caddy 를 다시 띄우지 않고 화면 파일만 볼륨에 반영

- 브랜치: feature/caddy-static-volume
- 커밋: 0c1ab34..14ccae0 (2개)
- 주요파일: deploy/compose.yaml, deploy/deploy.sh, deploy/web-publish.sh, docs/deployment.md

## 한 일

- `web` 서비스를 고정 이미지 `caddy:2.11.8-alpine` 으로 바꿨다. 설정은 `deploy/caddy/` 를 디렉터리째 붙이고, 화면 파일은 `web-dist` 볼륨에서 읽는다.
  - `deploy/Caddyfile` 을 `deploy/caddy/Caddyfile` 로 옮겼다.
- `web.Dockerfile` 의 마지막 단계를 Caddy 대신 `busybox:1.37` 에 `dist` 와 `web-publish.sh` 만 담는 이미지로 바꿨다. 태그는 그대로 `web-<SHA>` 다.
- compose 에 `web-files`(profile `publish`)를 두고, `deploy.sh` 가 `up --wait` 뒤에 `run --rm web-files` → `caddy reload` 를 부른다.
- `web-publish.sh`: 옛 파일은 지우지 않고, 파일마다 `.tmp` 로 쓴 뒤 `mv`, HTML 은 마지막에 바꾼다.
- `docs/deployment.md` 에 「구조」 절(서버 구성 flowchart, 배포 순서 sequenceDiagram)을 넣고 4·13절을 고쳤다. `architecture.md` 관련 문서에 링크를 걸었다.

## 왜 이렇게 했나

- 무중단 배포(블루그린) 검토의 1단계다. 지금은 `web-<SHA>` 가 커밋마다 바뀌어 프런트가 안 바뀐 배포에서도 Caddy 가 재시작되고 80·443 이 몇 초 끊겼다. Caddy 가 실제로 다시 떠야 하는 건 버전을 올릴 때뿐이고, Caddyfile 변경은 reload 로 된다. 블루그린 업스트림 전환도 reload 로 할 것이라 어차피 필요한 분리다.
- Caddy 버전은 2026-11-05 운영 컨테이너에서 확인한 v2.11.8 로 고정했다. `caddy:2-alpine` 은 빌드마다 모르게 버전이 올라갈 수 있었다.
- Caddyfile 을 파일 하나로 bind mount 하면 `git checkout` 이 새 파일(새 inode)을 써도 컨테이너는 옛 파일을 본다. 그래서 디렉터리째 붙이려고 `deploy/caddy/` 로 옮겼다.
- `web-publish.sh` 를 `deploy/caddy/` 가 아니라 `deploy/` 에 둔 이유: `.gitattributes` 의 `deploy/*.sh text eol=lf` 에 걸려야 Windows 에서 빌드해도 CRLF 로 깨지지 않는다.
- 옛 파일을 지우면 이미 화면을 연 브라우저가 옛 해시 청크를 불러 404 가 난다. 배포당 수 MB 라 정리는 넣지 않았다.
- 화면 파일은 새 백엔드가 healthy 가 된 뒤에 옮긴다. 지금처럼 새 화면이 옛 API 를 부르는 시간을 만들지 않으려고 했다.

## 확인한 것

- 로컬 Docker: 새 web 이미지 빌드 → 옛 파일을 둔 볼륨에 publish → `caddy:2.11.8-alpine` 으로 서빙.
  - `/`·`/faq` 는 h1 1개, `/upload` 는 noindex(app.html), 옛 `/assets/old-hash.js` 200, 새 asset 은 immutable 캐시 헤더, `.tmp` 0개, `/api/v1/*` 는 502(백엔드 없음)
  - Caddyfile 에 헤더를 더하고 `caddy reload` → 헤더가 붙고 `StartedAt` 이 그대로. 깨진 설정으로 reload 하면 exit 1 이고 옛 설정으로 200 을 계속 낸다
- `docker compose ... run --rm web-files`(profile 서비스)가 실제 compose 파일로 돈다. 프로필 없이 `config --services` 에는 `web-files` 가 없다(up 이 띄우지 않음).
- CI 와 같은 `compose config --quiet`, shellcheck(deploy.sh, web-publish.sh), mermaid-cli 렌더링 통과.

## 남은 것 · 아는 문제

- 이 커밋을 처음 배포할 때는 web 이미지가 바뀌어 컨테이너가 한 번 다시 뜬다. 그 직후 `web-files` 가 돌기 전까지 몇 초 동안 볼륨이 비어 화면이 404 일 수 있다. 이 한 번뿐이다.
- 실제 ECR pull·SSM 배포와, Linux 에서 디렉터리 bind mount 가 `git checkout` 결과를 바로 보는지는 운영 배포 뒤 확인한다(`StartedAt` 이 다음 배포에서 그대로인지 포함).
- `frontend/` 주석 5곳(vite.config.ts, seo.ts, Privacy.tsx, prerender.mjs, http.ts)과 `frontend/README.md` 가 아직 `deploy/Caddyfile` 을 가리킨다. FE 담당에게 넘긴다.
- 다음 단계는 backend·ai 블루그린(PR 2)이다. develop 의 backend 가 `127.0.0.1:8080` 을 호스트에 열고 있어(CloudWatch Agent 수집) 두 벌을 같이 띄울 때 포트가 겹친다. PR 2 에서 다룬다.

## 20:17 가짜 EC2 로 배포를 재현해 첫 배포 404 를 고쳤다

- `docker:29-dind` 로 가짜 EC2(메모리 3.8GB 제한)를 띄웠다. 로컬 레지스트리, 가짜 `aws`, bare 저장소의 `release` 를 두고 `deploy.sh` 를 그대로 돌렸다. 로컬에는 CloudWatch 가 없어 backend 로그 드라이버만 json-file 로 바꾼 커밋을 얹었다.
- 0.2초마다 `/` 와 `/api/v1/users/me` 를 부르며 끊김을 쟀다.

| 배포 | 화면 끊김 | API 끊김 | Caddy 재시작 |
| --- | --- | --- | --- |
| develop 구조 재배포 | 18.1초 | 20.6초 | 예 |
| 이 PR 첫 커밋 그대로 첫 배포 | 배포 뒤 계속 404 | 22.0초 | 예 |
| 고친 뒤 첫 배포 | 18.0초 | 20.4초 | 예(한 번) |
| 고친 뒤 재배포 | 0 | 12.7초 | 아니오 |
| 고친 뒤 Caddyfile 변경 배포 | 0 | 13.0초 | 아니오(새 헤더 반영) |

- 원인: SSM 이 띄우는 `deploy.sh` 는 직전 배포의 파일이다. 스크립트가 새 커밋을 checkout 해도 bash 는 이미 연 옛 파일을 끝까지 돈다. 그래서 `run --rm web-files` 를 스크립트에 넣으면 첫 배포에서는 돌지 않고, 새 compose 의 빈 `web-dist` 로 Caddy 만 다시 뜬다.
- 고침: `web-files` 를 profile 없는 일회성 서비스로 두고 `backend` healthy 뒤에 돌게 했다. `web` 은 `web-files` 완료 뒤에 뜬다. `deploy.sh` 에는 `caddy reload` 만 남겼다. 이 규칙을 `deployment.md` 4절에 적었다.
- Linux(가짜 EC2)에서 `git checkout` 으로 바뀐 Caddyfile 이 디렉터리 마운트로 바로 보이고 reload 로 반영되는 것도 확인했다.
- 운영 compose 는 v5.5.1, 로컬은 v5.7.0 이다. 판정 run 이 도는 중의 배포는 재지 않았다.
- 다음 PR(블루그린)도 첫 배포는 이 PR 의 `deploy.sh` 로 돈다. 설계할 때 감안한다.

## 20:55 deploy.sh 가 checkout 뒤 대상 커밋의 자기 자신으로 다시 실행

- `deploy.sh` 가 잠금·release 확인·checkout 까지 한 뒤 `KTC4_DEPLOY_CHECKED_OUT=1 exec bash "$repo/deploy/deploy.sh" "$@"` 로 대상 커밋의 스크립트에 넘긴다. 잠금은 fd 9 를 이어받고, 다시 실행된 쪽은 이 블록을 건너뛴다.
- 이유: 다음 PR(블루그린)은 배포 절차 자체를 바꾼다. 이게 없으면 그 PR 의 첫 배포를 이 PR 의 스크립트가 돌려 새 compose 와 맞지 않는다. 이 PR 안에 들어가야 다음 PR 첫 배포부터 효과가 있다.
- 이 PR 자신의 첫 배포는 여전히 옛 스크립트가 돈다. 그래서 `web-files` 를 compose 에 둔 앞의 고침은 그대로 필요하다.
- `--rollback` 으로 재실행이 없는 옛 커밋에 가면 그 스크립트가 `exec 9>` 로 잠금을 다시 잡는다. 이어받은 fd 가 닫히며 잠금이 잠깐 풀렸다 다시 잡힌다.
- 가짜 EC2 확인: 이 커밋을 배포한 뒤 블루그린 브랜치를 배포하니 새 스크립트로 넘어가 돌았다(블루그린 쪽 전환이 실행됨). `--rollback` 으로 이 커밋에 돌아오는 것도 돌았다.
