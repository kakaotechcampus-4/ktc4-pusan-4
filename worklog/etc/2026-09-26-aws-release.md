# AWS 단일 서버 배포 기반

- 브랜치: `feat/aws-deploy` (기존 작업 트리와 분리한 `.claude/worktrees/aws-deploy`)
- 주요 파일: `deploy/`, `.github/workflows/aws-release.yml`, `docs/deployment.md`

## 한 일

- `release` push에서 검증, ECR 이미지 업로드, SSM 배포를 수행하도록 워크플로를 추가했다. 배포 역할은 팀에서 제공한 OIDC 역할을 사용한다.
- EC2 한 대에서 Caddy, Spring, FastAPI, PostgreSQL을 실행하는 운영 Compose와 Dockerfile을 추가했다. 외부 포트는 80·443만 바인딩한다.
- 서버는 이미지 빌드를 하지 않고 ECR에서 커밋 SHA 태그를 pull한다. PostgreSQL 이미지는 소스 트리 해시로 태그를 고정해 같은 이미지 재빌드를 피한다.
- DB와 인증서는 영속 볼륨에 두고, S3 백업 타이머·복원 확인·수동 이미지 롤백 절차를 문서화했다.

## 판단 근거

- 현재 백엔드 기본 설정은 Swagger를 닫고 Spring 표준 DB 환경 변수를 받으므로 이름만 다른 운영 프로필을 만들지 않았다.
- 프런트는 목업 데이터, 백엔드 주요 API는 501인 현재 상태이므로 이번 완료 기준을 서비스 기동으로 명시했다.
- RDS와 로드밸런서는 승인 대상이고 t3.medium 한 대가 제공되므로 DB와 프록시를 같은 EC2에 둔다. AI와 DB 포트는 인터넷에 공개하지 않는다.
- `release`는 배포 설정이 `develop`에 머지된 뒤 생성한다. 기존 멘토 승인 `develop → main` 흐름을 기다리지 않고 개발 중 배포를 확인할 수 있다.

## 남은 것

- 팀 AWS 계정에서 EIP, DuckDNS, ECR, 비공개 S3, GitHub 변수와 역할 권한을 확인해야 첫 배포를 실행할 수 있다.
- `feat/aws-deploy → develop` PR로 리뷰받는다.

## 로컬 검증

- 백엔드 `test`와 `integrationTest`, AI Ruff와 pytest(88개), 프런트엔드 빌드와 lint를 통과했다. lint는 기존 경고 12개만 출력했다.
- 네 개의 Docker 이미지를 빌드하고 Caddy 설정 및 Compose 구문을 확인했다.
- 격리된 Compose 프로젝트에서 PostgreSQL·Spring·AI의 healthcheck가 모두 통과했다. `db/schema.sql`과 `db/rag.sql` 적용도 확인했다.
- 첫 기동에서 스키마를 PostgreSQL 초기화 스크립트로 실행하면 Flyway가 비어 있지 않은 스키마를 거부했다. 초기화 시 확장만 만들고, Flyway가 먼저 실행된 뒤 나머지 SQL을 적용하도록 순서를 수정했다.
- 로컬 Caddy의 `/upload`는 200을, `/api/v1/users/me`는 프록시를 거쳐 현재 구현 상태인 501을 반환했다.

## AWS 준비와 PR

- 팀 계정 `369992801983`의 제공 EC2를 시작하고 EIP `52.78.114.159`를 연결했다. 보안그룹은 80·443만 인바운드로 열었다.
- 서울 리전에 변경 불가 태그 ECR 저장소와 비공개 S3 백업 버킷을 만들었다. S3 백업은 7일, ECR 이미지는 90일 뒤 정리되도록 설정했다.
- DuckDNS `ktc4-pusan-4.duckdns.org`가 EIP를 가리키는 것을 확인하고 GitHub Actions 변수 4개를 등록했다.
- EC2에 Docker와 AWS CLI v2를 설치하고 인스턴스 역할의 ECR 로그인, S3 쓰기·읽기를 확인했다. 운영 환경 파일은 서버에서 비밀번호를 생성해 root 전용으로 만들었다.
- ECR 로그인 정보가 서버의 기본 Docker 설정에 남지 않도록 배포 스크립트가 임시 Docker 설정 디렉터리를 사용한다.
- PR #58의 검증 작업은 통과했다. `develop` 반영에는 필수 리뷰가 필요하다.
- `release` 대상 PR도 같은 검증을 받도록 트리거를 확장했다. 경로 제한을 없애 앱 코드만 바뀐 승격 PR에서도 CI가 실행되게 했다.
- GitHub `release` 브랜치에 승인 1명과 강제 푸시 금지 규칙을 등록했다.
