# README 도식 · Langfuse 모니터링 추가, 목차 줄바꿈 수정

- 브랜치: feature/readme-reorder
- 커밋: a4ddb00a (1개)
- 주요파일: README.md, docs/img/readme/rag.png, docs/img/readme/corpus-sync.png, docs/img/readme/langfuse.gif

## 한 일

- 「RAG · 코퍼스 동기화」의 도식화 자리를 `### RAG` · `### 코퍼스 동기화` 소제목과 다이어그램 이미지로 교체하고, 각 아래에 한 줄 설명을 인용으로 붙임. `✏️ 작성 필요` 자리는 삭제
- 「모니터링 (CloudWatch)」을 「모니터링」으로 바꾸고 하위에 `#### CloudWatch`(도식화 자리 유지)와 `#### Langfuse (AI 에이전트 모니터링)`(langfuse.gif)를 둠
- 목차 오른쪽 제목 「🤝 팀이 개발한 방법」의 띄어쓰기를 `&nbsp;` 로 바꿈

## 왜 이렇게 했나

- GitHub 표는 `width: max-content` 라 칸이 내용 폭에 맞춰 줄어든다. 오른쪽 칸 폭이 제목 길이와 거의 같아 폰트에 따라 「방법」이 다음 줄로 넘어갔다. `td width="50%"` 로는 표 전체가 넓어지지 않아서, 줄바꿈 없는 공백으로 칸이 제목 폭만큼 넓어지게 했다

## 남은 것 · 아는 문제

- CI/CD · Redis · Blue/Green · CloudWatch 도식화 자리는 아직 비어 있음
- langfuse.gif 가 2.2MB 로 다른 GIF(0.2~0.4MB)보다 큼

## 02:14 README CI/CD 파이프라인 도식 추가

- 커밋: c90ef249 (1개)
- 주요파일: README.md, docs/img/readme/cicd.png

### 한 일

- 「CI/CD 파이프라인」 도식화 자리를 `cicd.png` 로 교체. 개발자 PR → GitHub → release 머지 → GitHub Actions → 이미지 빌드, ECR push / SSM 으로 EC2 `deploy.sh` 실행 → ECR 에서 pull 해 Docker Compose 로 idle 색 기동, 블루그린 전환 흐름을 그림
- 흐름은 `.github/workflows/aws-release.yml`, `deploy/deploy.sh` 에 맞춤
- 너비는 `architecture-hd.png` 와 같은 3050px

### 왜 이렇게 했나

- 아키텍처 그림에는 GitHub Actions, ECR, SSM 경로가 없어 배포 흐름은 따로 그림이 필요했다

### 남은 것 · 아는 문제

- 그림의 편집용 원본(pptx)은 레포에 넣지 않았다
- Redis, Blue/Green, CloudWatch 도식화 자리는 아직 비어 있음

## 02:20 README CloudWatch 대시보드 캡처 추가

- 커밋: 8b44e729 (1개)
- 주요파일: README.md, docs/img/readme/cloudwatch.png

### 한 일

- 「모니터링 > CloudWatch」의 도식화 자리를 운영 대시보드 `ktc4-backend` 캡처(`cloudwatch.png`)로 교체. 도식 대신 Langfuse 처럼 실제 화면을 넣음
- 캡처는 대시보드 제목과 위젯 6개(CPU, 메모리, 디스크, 5xx와 기동, JVM 힙, Hikari와 판정 풀 대기)만 잘랐다. 콘솔 상단의 계정 ID와 사용자 이메일은 들어가지 않게 했다

### 남은 것 · 아는 문제

- 캡처는 2026-11-09 기준 최근 3시간 화면이라 값은 그때 것이다
- Redis, Blue/Green 도식화 자리는 아직 비어 있음

## 02:38 README Redis, Blue/Green 시퀀스 다이어그램 추가

- 커밋: 1ca4470d (1개)
- 주요파일: README.md

### 한 일

- 「Redis」 자리를 리프레시 토큰 교체 mermaid 시퀀스 다이어그램으로 채우고 소제목을 「Redis (리프레시 토큰 교체)」로 바꿈. 로그인 때 발급, 재발급 때 Lua 스크립트로 해시 비교와 교체, 이미 쓴 토큰이면 그 family 삭제, 로그아웃을 그림(`RedisRefreshTokenStore`, `AuthService`)
- 「Blue / Green 배포」 자리를 deploy.sh 기준 전환 시퀀스로 채움. 쉬는 색 기동과 Flyway, healthy 뒤 upstream.caddy 교체와 caddy reload, 성공하면 옛 색 stop, 실패하면 되돌림(`deploy/deploy.sh`)
- 각 그림 아래에 한두 문장 설명을 붙임

### 왜 이렇게 했나

- Redis 는 이미지 출처나 띄우는 방식보다 토큰 교체 흐름이 코드만으로 잘 안 읽혀서 그쪽을 그렸다
- 아키텍처 그림이 두 쌍의 구조는 이미 보여 줘서, Blue/Green 은 시간 순서를 시퀀스로 그렸다
- 두 그림 모두 PNG 대신 mermaid 로 두어 코드가 바뀌면 텍스트로 고칠 수 있게 했다

### 남은 것 · 아는 문제

- mermaid 11.4.1 로 렌더링은 확인했지만 GitHub 화면에서는 아직 보지 않았다
- Redis 다이어그램이 「배포 · CI/CD」 섹션 안에 있어 위치가 어색할 수 있다
