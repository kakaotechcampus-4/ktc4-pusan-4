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
