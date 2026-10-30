# application-local.yml 의 중복된 app 키를 하나로 합친다 (hotfix)

- 브랜치: develop 직접 push
- 커밋: 1개
- 주요파일: application-local.yml

## 한 일

- `app.judgment-run` 을 첫 `app:` 블록(`app.auth`) 아래로 옮기고 두 번째 `app:` 을 지웠다. 값은 바꾸지 않았다.

## 왜 이렇게 했나

- #154 가 `app.auth`, #169 가 `app.judgment-run` 을 각자 새 최상위 `app:` 블록으로 더했다. 둘 다 develop 기준으로는 `app:` 이 없던 자리라 텍스트 충돌 없이 합쳐졌다.
- Spring Boot 는 YAML 중복 키를 거부해서 local 프로필로 기동하면 설정을 읽다 실패한다. 테스트는 local 프로필을 쓰지 않아 CI 에서 드러나지 않는다.

## 확인한 것

- 중복 키를 거부하는 YAML 로더로 다시 읽어 `app` 아래에 `auth`·`judgment-run` 이 함께 있는 것을 확인했다.
- 이 환경에서는 Gradle 의존성을 받지 못해 bootRun 으로 띄워 보지 않았다.
