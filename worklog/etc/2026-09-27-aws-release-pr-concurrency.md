# AWS 배포 PR 동시 실행 조정

- 브랜치: `feat/aws-deploy`
- 파일: `.github/workflows/aws-release.yml`

같은 PR에 새 커밋이 올라오면 진행 중인 이전 검증 실행을 취소한다. `release` push에서는 진행 중인 배포 실행을 취소하지 않는다. 기존 워크플로 수준의 동시 실행 그룹은 유지하므로 `release`의 검증 job도 직렬로 실행된다.
