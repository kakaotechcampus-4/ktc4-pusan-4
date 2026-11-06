# 블루그린 리뷰 반영: reload 실패 시 upstream 복원과 첫 기동 경로

- 브랜치: feature/blue-green-deploy
- 커밋: 34dd738..c1c3f89 (2개, develop 머지 포함)
- 주요파일: deploy/deploy.sh, deploy/compose.yaml, docs/deployment.md

## 한 일

- #252 가 머지되어 #253 의 base 를 develop 으로 바꾸고 develop 을 머지했다(리베이스 대신 머지, force push 를 피하려고).
- `deploy.sh`: `upstream.caddy` 를 쓰기 전 내용을 변수에 담아 두고, `up --no-deps web` 이나 `caddy reload` 가 실패하면 그 내용으로 되돌린 뒤(원래 없었으면 지움) 실패로 끝낸다.
- 서버를 처음 띄우는 것도 `deploy.sh` 로만 한다고 compose 머리 주석과 `deployment.md` 3절에 적었다. `web` 의 `depends_on: web-files` 와 그 주석을 지웠다.
- `deployment.md` 4절: 블루그린 전환에 reload 실패 시 동작을 적고, #252 첫 배포에만 해당하던 예외 문단을 지웠다.

## 왜 이렇게 했나

- memoryhong 리뷰. reload 가 실패하면 Caddy 는 옛 색으로 보내는데 파일은 새 색이라, 다음 배포가 지금 받는 색을 쉬는 색으로 알고 다시 만들어 API 가 끊긴다.
- `upstream.caddy` 는 `deploy.sh` 가 쓰기 전엔 없고, Caddy 는 없는 파일 import 를 설정 오류로 본다. 색별 backend·ai 는 profile 이라 이름 없는 `up` 으로는 어차피 서비스가 안 된다. 3절이 원래 첫 release 배포로 띄우게 되어 있어 그 경로만 남겼다.
- `depends_on: web-files` 는 #252 에서 옛 스크립트가 도는 첫 배포용으로 넣었다. 이 PR 의 `deploy.sh` 는 `up --no-deps web` 뒤 `run web-files` 를 직접 부르므로 이름 없는 `up` 말고는 쓰는 곳이 없었다. 지워도 web 컨테이너는 다시 뜨지 않았다.

## 확인한 것

가짜 EC2(어제 쓴 것 재사용), 0.2초마다 `/`·API 호출

| 배포 | 결과 | 화면·API 끊김 |
| --- | --- | --- |
| R1 리뷰 반영 커밋 (green → blue) | 성공, Caddy 재시작 없음 | 0 |
| R2 Caddyfile 에 없는 지시어 | reload 실패로 rc=1, `upstream.caddy` 는 blue 로 복원 | 0 |
| R3 R2 를 되돌린 커밋 | 쉬던 green 만 다시 만들어 넘김 | 0 |
| 빈 서버(컨테이너·볼륨·upstream 없음)에서 R3 | 성공, green 으로 뜸 | 처음 뜨는 동안만 |

- 이름 없는 `docker compose up -d` 는 Caddy 가 `File to import not found: upstream.caddy` 로 뜨지 않는 것을 재현했다.
- 빈 서버 첫 시도는 `down -v` 가 profile 서비스(색별 컨테이너)를 지우지 않아 옛 green 이 남은 채 돌아 무효였다. 프로젝트 라벨로 컨테이너·볼륨을 모두 지우고 다시 했다.
- shellcheck, `compose config --quiet` 통과.

## 남은 것 · 아는 문제

- R1 배포에서 redis 가 다시 만들어졌다. 정의 변경은 없어 `pull` 로 받은 이미지가 바뀐 것으로 보이며 이 PR 과 무관하다. 확인은 하지 않았다.
