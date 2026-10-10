# release-source 는 기본 브랜치(develop) 의 워크플로 파일로 돈다

- 브랜치: docs/release-source-default-branch
- 커밋: 2d16ea6..2d16ea6 (1개)
- 주요파일: .github/workflows/release-source.yml, docs/deployment.md

## 한 일

- `release-source.yml` 주석과 `docs/deployment.md` 2절에서 "`pull_request_target` 은 `release` 의 워크플로 파일로 돈다" 를 "기본 브랜치(`develop`) 의 파일로 돈다" 로 고쳤다.
- 2절에 있던 "파일이 `release` 에 들어간 뒤에 필수 체크를 등록한다" 를 지우고, GitHub 변경 공지 링크를 달았다.

## 왜 이렇게 했나

- 배포 PR #85(`develop → release`) 를 열자 `release` 에 파일이 없는데도 `release-source` 가 돌아 통과했다. 실행 기록의 event 는 `pull_request_target`, head_sha 는 `develop` 의 4f575b3 였다.
- GitHub 이 2025-12-08 부터 `pull_request_target` 의 워크플로 파일과 checkout 커밋을 base 가 아닌 기본 브랜치에서 가져오도록 바꿨다. 이 레포의 기본 브랜치는 `develop` 이다.
- PR 안에서 파일을 고쳐 체크를 통과시킬 수 없다는 결론은 그대로다. `develop` 의 파일을 바꾸려면 `develop` ruleset 의 리뷰를 거쳐야 한다.

## 남은 것 · 아는 문제

- 필수 체크 등록은 #85 머지를 기다릴 필요가 없다.
- base 를 `release` 로 바꿨을 때(`edited`) 체크가 다시 도는지는 아직 확인하지 않았다.

## 12:37 PR 에서 배포 이미지를 빌드한다

- 브랜치: fix/ci-image-build
- 커밋: a1d7622..a1d7622 (1개)
- 주요파일: .github/workflows/aws-release.yml, docs/deployment.md

#85 머지 뒤 `release` push 배포가 web 이미지 빌드에서 실패했다(run 37259572002). `712bb6f` 부터 `npm run build` 가 `../../rules/categories.yaml` 을 읽는데, `deploy/web.Dockerfile` 은 `frontend/` 만 복사해서 `/rules/categories.yaml` 이 없었다. 이미지 빌드 단계에서 멈춰서 운영 서버는 이전 버전(`820b66f`) 그대로다.

PR 의 `web` 체크는 레포 전체를 체크아웃한 상태에서 빌드하니 통과했다. CI 가 검증하는 빌드와 배포가 하는 빌드가 달라서, Dockerfile 이 깨져도 `release` push 에서야 드러난다. 그래서 Dockerfile 만 고치지 않고 `backend`·`ai`·`web` 잡에 배포와 같은 Dockerfile·컨텍스트로 이미지를 빌드하는 단계를 넣었다. push 는 하지 않고 PR 에서만 돈다. `release` push 에서는 `deploy` 잡이 어차피 빌드한다. 이미 필수 체크인 잡 안에 넣어 ruleset 은 건드리지 않았다.

이 커밋만으로 PR 을 올려 `web` 이 같은 ENOENT 로 실패하는지 먼저 본다. 그다음 커밋에서 Dockerfile 을 고친다. actionlint 는 로컬 Docker 가 꺼져 있어 못 돌렸고, YAML 파싱만 확인했다.

## 12:40 web 이미지에 카테고리 원본을 넣는다

- 브랜치: fix/ci-image-build
- 커밋: 73e9c9f..73e9c9f (1개)
- 주요파일: deploy/web.Dockerfile

CI 변경만 담은 커밋에서 `web` 잡의 `Build production image` 가 배포 때와 같은 `ENOENT ... '/rules/categories.yaml'` 로 실패했다(run 37260200228). `npm run build` 단계는 통과했다. CI 가 이제 이 문제를 잡는다. `backend`·`ai` 이미지는 빌드됐다.

`check-categories.mjs` 가 `/src/scripts` 기준 `../../rules/categories.yaml` 을 읽으므로 `web.Dockerfile` 에서 `rules/categories.yaml` 을 `/rules/categories.yaml` 로 복사했다. 빌드 컨텍스트가 레포 루트이고 `.dockerignore` 가 `rules/` 를 빼지 않는다.
