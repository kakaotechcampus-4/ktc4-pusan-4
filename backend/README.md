# Backend

Java 21, Spring Boot 3.5, JPA, PostgreSQL로 구성된 백엔드 애플리케이션입니다.

## 로컬 실행

필요한 도구는 JDK 21과 Docker입니다. 시스템에 Gradle을 별도로 설치할 필요는 없습니다.

저장소 루트에서 PostgreSQL을 실행합니다.

```shell
docker compose up -d postgres
```

Windows에서는 다음 명령으로 애플리케이션을 실행합니다.

```powershell
.\backend\gradlew.bat -p backend bootRun --args="--spring.profiles.active=local"
```

macOS와 Linux에서는 다음 명령을 사용합니다.

```shell
bash ./backend/gradlew -p backend bootRun --args='--spring.profiles.active=local'
```

실행 후 `GET http://localhost:8080/actuator/health`에서 애플리케이션과 DB 연결 상태를 확인할 수 있습니다.

`local` 프로필의 기본 연결값은 다음과 같습니다. 필요한 경우 같은 이름의 환경 변수로 변경합니다.

| 환경 변수 | 기본값 |
| --- | --- |
| `DB_URL` | `jdbc:postgresql://localhost:15432/ktc4` |
| `DB_PORT` | `15432` |
| `DB_NAME` | `ktc4` |
| `DB_USERNAME` | `ktc4` |
| `DB_PASSWORD` | `ktc4-local` |

로컬 프로필을 사용하지 않는 환경에서는 Spring 표준 환경 변수인 `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`를 주입합니다.

## 테스트

단위 테스트는 `src/test/java`, PostgreSQL이 필요한 통합 테스트는 `src/integrationTest/java`에 둡니다.

```powershell
.\backend\gradlew.bat -p backend test
.\backend\gradlew.bat -p backend integrationTest
.\backend\gradlew.bat -p backend check
```

`integrationTest`와 `check`는 Docker가 실행 중이어야 합니다. CI도 단위 테스트와 통합 테스트를 별도 단계로 실행합니다.

## 코드 구성

기능 코드는 `com.ktc4.pusan4.<feature>` 아래에 모으고, 기능 내부에서 controller, service, repository, entity, dto로 나눕니다. 둘 이상의 기능에서 실제로 공유되기 전에는 공통 계층을 만들지 않습니다.

DB 스키마는 Flyway만 변경합니다. 마이그레이션은 `src/main/resources/db/migration`에 `V1__create_member.sql` 형식으로 추가하며, 이미 적용된 파일은 수정하지 않고 새 버전의 파일을 추가합니다. Hibernate는 스키마를 생성하지 않고 애플리케이션 시작 시 매핑을 검증합니다.
