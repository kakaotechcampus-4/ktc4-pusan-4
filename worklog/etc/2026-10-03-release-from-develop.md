# release 로 가는 PR 을 develop 에서만 받는다

- 브랜치: chore/release-from-develop
- 커밋: 53a319f..53a319f (1개)
- 주요파일: .github/workflows/release-source.yml, docs/deployment.md

## 한 일

- `Release source` 워크플로를 추가했다. `release` 로 가는 PR 의 head 가 이 레포의 `develop` 이 아니면 `release-source` 체크가 실패한다. fork 의 `develop` 도 막는다.
- `docs/deployment.md` 2절에 `release` PR 은 `develop` 에서만 열고 `release-source` 를 `release` ruleset 필수 체크로 등록한다고 적었다.

## 왜 이렇게 했나

- 멘토 피드백 대응이다. `main`·`develop` 두 방향에서 `release` 로 들어오지 않게 브랜치를 하나로 하라는 것. 승인은 이미 `release 배포 승인` ruleset 이 강제하고 있어서 출처만 남았다.
- 단일 원천은 `develop` 으로 했다. 배포 문서가 이미 `develop → release` 로 정해 두었고, `main` 은 멘토 리뷰 흐름이라 배포와 엮지 않는다. 완성 단계에서 `main` 으로 옮길지는 그때 정한다.
- ruleset 에는 PR 출처 브랜치를 제한하는 규칙이 없어서 필수 체크로 막는다.
- `aws-release.yml` 에 넣지 않고 파일을 따로 뒀다. base 를 `release` 로 바꾼 PR 을 다시 검사하려면 `edited` 를 받아야 하는데, 제목·본문 수정에도 발화한다. 기존 워크플로에 넣으면 그때마다 백엔드 테스트까지 다시 돈다. `edited` 가 없으면 `develop` 대상일 때 통과한 체크가 남아 base 만 바꿔 머지할 수 있다.

## 남은 것 · 아는 문제

- `release-source` 를 ruleset 필수 체크로 등록하는 건 이 PR 이 `develop` 에 머지된 뒤에 한다. 먼저 걸면 `develop` 에 워크플로가 없어 체크가 생기지 않고 `release` PR 이 전부 막힌다.
- base 변경 시 재검사는 실제 GitHub 에서 확인하지 않았다. actionlint 와 입력 4가지(이 레포 develop / feat/x / fork develop / develop-x)로 체크 로직만 확인했다.
