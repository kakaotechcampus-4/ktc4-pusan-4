# release-source 를 pull_request_target 으로 돌린다

- 브랜치: chore/release-from-develop
- 커밋: 5c8bbe3..5c8bbe3 (1개)
- 주요파일: .github/workflows/release-source.yml, docs/deployment.md

## 한 일

- `Release source` 트리거를 `pull_request` 에서 `pull_request_target` 으로 바꿨다. types·branches 는 그대로다.
- `docs/deployment.md` 2절에 이 체크가 `release` 의 워크플로 파일로 돌고, 그래서 필수 체크 등록은 파일이 `release` 에 들어간 뒤에 한다고 적었다.

## 왜 이렇게 했나

- #77 리뷰 반영이다. `pull_request` 는 PR 머지 커밋의 워크플로로 돌아서, `feat/x → release` PR 안에서 이 파일을 고치면 고친 버전으로 체크가 통과한다. `pull_request_target` 은 base(`release`) 의 파일로 돌아 이 우회가 막힌다.
- `pull_request_target` 의 위험(권한 있는 토큰·secret 으로 PR 코드 실행)은 해당하지 않는다. checkout 이 없고 `permissions: {}` 이며, `head.ref` 는 env 로만 받는다.

## 남은 것 · 아는 문제

- 등록 시점이 바뀌었다. 이 PR 이 `develop` 에 머지된 뒤가 아니라, 다음 `develop → release` 배포 PR 이 머지돼 파일이 `release` 에 들어간 뒤에 필수 체크로 등록한다. 그 배포 PR 에는 이 체크가 돌지 않는다.
- `pull_request_target` 체크가 ruleset 필수 체크를 채우는지, base 변경(`edited`) 때 다시 도는지는 실제 GitHub 에서 확인하지 않았다. actionlint 만 통과했다.
