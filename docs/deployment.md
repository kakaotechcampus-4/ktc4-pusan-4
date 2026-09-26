# AWS 배포

카테캠 팀 계정의 Ubuntu 24.04 EC2 한 대에 `deploy/compose.yaml`을 실행한다. 배포 코드는 별도 worktree의 `feat/aws-deploy`에서 작성해 `develop`으로 머지한다. 첫 `release`는 이 설정이 포함된 `develop` 커밋에서 만들고, 이후 `develop → release` PR의 push가 자동 배포를 시작한다. 기존 `develop → main` 멘토 리뷰 흐름은 유지한다.

현재 프런트엔드는 목업 데이터로 동작하며 주요 백엔드 API는 501을 반환한다. 이 배포의 완료 기준은 전체 스택의 정상 기동이다. 실제 카드 데이터로 시험하기 전에는 인증과 API 연동을 완료해야 한다.

## 1. AWS와 DNS 준비

1. 서울(`ap-northeast-2`)의 제공된 EC2에 Elastic IP를 할당·연결한다. DuckDNS에서 서브도메인을 발급하고 A 레코드를 그 EIP로 설정한다. 고정 EIP이므로 DuckDNS 토큰을 GitHub Actions에 등록하지 않는다.
2. EC2 보안그룹 인바운드는 TCP 80·443만 공개한다. 22·5432·8000·8080은 열지 않는다. 인스턴스 접속은 Session Manager를 사용한다.
3. 서울 리전에 비공개 ECR 저장소 `ktc4-pusan-4` 하나를 만든다. 태그는 `backend-<SHA>`, `ai-<SHA>`, `web-<SHA>`, `postgres-<Dockerfile 디렉터리 트리 해시>` 형식이다. 태그 변경 방지를 설정하고 저장소 수명 주기 정책으로 오래된 이미지를 정리한다. 배포 직전 버전은 복구할 수 있도록 최소 7일 보존한다.
4. 비공개 S3 버킷을 만들고 퍼블릭 액세스를 차단한다. `postgres/` 접두사의 객체는 7일 뒤 만료하도록 수명 주기를 설정한다. 백업 스크립트는 SSE-S3 암호화를 지정한다.
5. GitHub Actions의 사전 제공 역할 `ktc-github-deploy`에는 ECR 업로드·조회와 `ssm:SendCommand`, `ssm:GetCommandInvocation`이 필요하다. EC2 인스턴스 역할 `ktc-ec2-ssm-role`에는 ECR 다운로드와 백업 버킷의 `s3:PutObject`·`s3:GetObject`가 필요하다. 권한이 없다면 잠긴 운영진 역할을 수정하지 말고 인프라 매니저에게 필요한 작업과 리소스 범위만 요청한다. 두 역할은 서로 다르다.

AWS는 실행 중인 자동 할당 공인 IPv4와 EIP에 모두 요금을 부과한다. 중지된 인스턴스에 붙은 EIP에도 요금이 계속 붙는다. 비용은 [AWS 공인 IPv4 요금](https://aws.amazon.com/vpc/pricing/)에서 확인한다.

## 2. GitHub 설정

Repository **Settings → Secrets and variables → Actions → Variables**에 다음 값을 등록한다. 계정 ID는 비밀값이 아니다.

| 변수 | 값 |
| --- | --- |
| `AWS_ACCOUNT_ID` | 팀 AWS 계정의 12자리 ID |
| `ECR_REPOSITORY` | `123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/ktc4-pusan-4` 형태의 전체 URI |
| `EC2_INSTANCE_ID` | 제공된 EC2의 `i-...` ID |
| `DOMAIN` | DuckDNS에서 발급한 호스트 이름 |

워크플로는 `id-token: write`와 `contents: read`로 OIDC 임시 자격증명을 얻는다. AWS 액세스 키나 SSH 개인키를 GitHub Secrets에 넣지 않는다. `release` 브랜치는 PR 검토를 요구하도록 보호한다. `AWS release`의 `backend`, `ai`, `web` 검증이 통과한 커밋만 승격한다.

## 3. EC2 최초 준비

Session Manager의 Ubuntu 터미널에서 Docker Engine과 Compose 플러그인을 [Docker의 Ubuntu 24.04 설치 안내](https://docs.docker.com/engine/install/ubuntu/)에 따라 설치한다. AWS CLI v2가 없다면 [AWS 공식 설치 안내](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)를 따른다. `git`도 설치한다. 배포 스크립트는 SSM Run Command의 root 계정으로 실행되므로 `ubuntu`를 `docker` 그룹에 넣을 필요가 없다.

```bash
sudo mkdir -p /opt/ktc4 /etc/ktc4
sudo git clone https://github.com/kakaotechcampus-4/ktc4-pusan-4.git /opt/ktc4/repo
sudo cp /opt/ktc4/repo/deploy/production.env.example /etc/ktc4/production.env
sudo chmod 600 /etc/ktc4/production.env
sudoedit /etc/ktc4/production.env
```

환경 파일에 실제 ECR URI, 도메인, S3 버킷을 넣고 `DB_PASSWORD`는 `openssl rand -hex 24`로 생성한다. 이 파일은 Git이나 SSM 명령 인수에 넣지 않는다. `DATABASE_URL`이 비밀번호를 URL에 포함하므로 비밀번호는 예제처럼 영숫자만 사용한다. 외부 API 키는 해당 기능을 쓸 때 이 파일에 추가한다.

```bash
sudo docker compose version
sudo aws sts get-caller-identity
sudo aws ecr get-login-password --region ap-northeast-2 >/dev/null
```

첫 `release` push 전, EC2 인스턴스 역할로 ECR 로그인과 백업 버킷 업로드가 되는지 확인한다. 서버의 ECR URI와 GitHub 변수의 값은 같아야 한다. EIP와 DNS가 연결되고 80·443 인바운드가 열려 있어야 Caddy가 인증서를 발급할 수 있다.

## 4. 배포와 확인

`release` push가 발생하면 `.github/workflows/aws-release.yml`이 백엔드·AI·프런트 검증을 실행하고, GitHub 러너에서 이미지를 빌드해 ECR에 올린다. SSM이 EC2의 `deploy/deploy.sh`에 커밋 SHA를 전달한다. 스크립트는 원격 `release`의 현재 SHA와 일치하는지 확인하고 이미지 pull, Compose 기동, Flyway 완료 후 `db/schema.sql`과 `db/rag.sql`을 차례로 적용한다. DB 초기화 단계에서는 확장만 설치한다. `postgres-data`와 Caddy 인증서 볼륨은 재배포해도 유지된다.

```bash
sudo cat /opt/ktc4/current-sha
sudo docker ps --filter name=ktc4
curl -I "https://<도메인>/"
```

`docker compose ps`에서 PostgreSQL·백엔드·AI가 healthy이고 웹 컨테이너가 running이어야 한다. 브라우저에서 `/`, `/upload`를 새로고침해 SPA 라우팅을 확인한다. 백엔드 `/actuator/health`와 AI `/health/db`는 컨테이너 내부 검사로 확인하며 외부에 공개하지 않는다. `docker stats`와 `df -h`로 4GB 메모리·50GB 디스크 사용량을 확인한다.

## 5. 백업과 복구

첫 배포에 성공한 뒤 타이머를 설치한다. 매일 03:00 KST에 `pg_dump -Fc`를 S3로 스트리밍하므로 서버 디스크에 별도 덤프를 쌓지 않는다.

```bash
sudo cp /opt/ktc4/repo/deploy/ktc4-backup.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ktc4-backup.timer
sudo systemctl start ktc4-backup.service
sudo systemctl status ktc4-backup.service
```

첫 백업은 S3의 `postgres/` 경로에서 존재와 크기를 확인한다. 별도 임시 DB를 만들어 백업 파일을 `pg_restore`로 복원하고 `pg_tables`를 조회해 복원 가능성을 확인한 뒤 임시 DB를 삭제한다. 운영 DB를 복원 대상으로 사용하지 않는다.

이전 애플리케이션 이미지로 되돌릴 때는 SSM 터미널에서 아래 명령을 사용한다. 대상 SHA의 ECR 이미지가 남아 있어야 하며, Flyway가 적용한 스키마는 되돌리지 않는다. 스키마 변경 배포는 이전 애플리케이션과 호환되도록 나눠서 진행한다.

```bash
sudo bash /opt/ktc4/repo/deploy/deploy.sh <이전-40자리-SHA> --rollback
```
