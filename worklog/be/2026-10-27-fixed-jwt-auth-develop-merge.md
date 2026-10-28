# fixed-jwt-auth(#155) 에 develop 을 merge 하고 base 를 develop 으로 바꾼다

- 브랜치: feature/fixed-jwt-auth
- 커밋: 0dff761 (merge 1개)
- 주요파일: application.yml, deployment.md, backend/README.md

## 한 일

- base 였던 feature/bearer-access-token 이 #154 로 develop 에 들어가 base 를 develop 으로 바꿨다. develop(a7fb5a4)을 merge 했다. 뒤처진 develop 커밋은 44개다.
- `application.yml`: develop 이 #169 에서 `app.judgment-run` 을 `app.auth` 앞에 더했고, 이 브랜치는 `auth` 위 주석을 고정 사용자·demo-password 설명으로 바꿨다. `judgment-run` 을 먼저 두고 `auth` 주석은 이 브랜치 것을 썼다.
- `deployment.md`: develop 은 e72c678(B9a)에서 `## 8. Redis` 를, 이 브랜치는 `## 8. 로그인 (고정 사용자)` 를 같은 자리에 더했다. 이미 develop 에 있는 Redis 를 8절로 두고 로그인을 9절로 미뤘다. 이 브랜치가 넣은 `backend/README.md` 의 "deployment.md 8절" 참조도 9절로 고쳤다.
- `compose.yaml`·`production.env.example`·`application-local.yml` 은 자동 병합됐고 양쪽 값이 모두 들어간 것을 확인했다.

## 왜 이렇게 했나

- 이미 push 된 브랜치라 rebase + force push 대신 merge 했다.
- 리뷰 의견(카카오 진입점, revokeAll 연결)은 리뷰어가 B9b·B9c 에서 하겠다고 해 이 merge 에서 건드리지 않았다.

## 확인한 것

- `gradlew -p backend check` 통과(test 360, integrationTest 149, 스킵 0).
