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

모든 테스트는 Gradle 표준 경로인 `src/test/java`에 둡니다. 실행 속도와 외부 인프라 의존성을 기준으로 실행 명령만 분리합니다.

| 종류 | 클래스명 | 실행 명령 | Docker |
| --- | --- | --- | --- |
| 단위 테스트 | `*Test` (`*IntegrationTest` 제외) | `test` | 불필요 |
| 통합 테스트 | `*IntegrationTest` | `integrationTest` | 필요 |
| 전체 검증 | 위 테스트 전체 | `check` | 필요 |

순수한 도메인 규칙, 계산, 검증과 변환은 단위 테스트로 작성합니다. PostgreSQL, JPA, Flyway, 트랜잭션 또는 전체 Spring 구성이 필요한 검증은 통합 테스트로 작성합니다. 애플리케이션 전체를 검증하는 통합 테스트는 `com.ktc4.pusan4.integration` 패키지에 둡니다.

```powershell
.\backend\gradlew.bat -p backend test
.\backend\gradlew.bat -p backend integrationTest
.\backend\gradlew.bat -p backend check
```

`test`와 `integrationTest`는 같은 테스트 소스셋을 사용하므로 모두 함께 컴파일되지만 클래스명으로 실행 대상을 나눕니다. 새로운 통합 테스트는 클래스명을 `*IntegrationTest`로 작성해야 CI의 통합 테스트 단계에서 실행됩니다.

통합 테스트는 로컬 `compose.yaml`의 DB를 사용하지 않습니다. Testcontainers가 테스트 전용 PostgreSQL을 임의 포트에 생성하고, `@ServiceConnection`이 접속 정보를 Spring Boot에 전달하며, 테스트가 끝나면 컨테이너를 제거합니다. 현재 `BackendApplicationIntegrationTest`는 다음을 검증합니다.

1. Spring 애플리케이션이 실제 PostgreSQL과 함께 기동되는지
2. `/actuator/health`가 `UP`을 반환하는지
3. Flyway가 `flyway_schema_history` 테이블을 생성하는지

`integrationTest`와 `check`를 실행하기 전에는 Docker가 실행 중이어야 합니다. CI는 `test` 다음 `integrationTest`를 실행하며, 특정 클래스를 지정하지 않으므로 이후 추가되는 `*IntegrationTest`도 자동으로 포함합니다. 현재는 도메인 단위 테스트가 없어 `test`가 `NO-SOURCE`로 완료됩니다.

## 코드 구성

기능 코드는 `com.ktc4.pusan4.<feature>` 아래에 모으고, 기능 내부에서 controller, service, repository, entity, dto로 나눕니다. 둘 이상의 기능에서 실제로 공유되기 전에는 공통 계층을 만들지 않습니다.

DB 스키마는 Flyway만 변경합니다. 마이그레이션은 `src/main/resources/db/migration`에 `V1__create_member.sql` 형식으로 추가하며, 이미 적용된 파일은 수정하지 않고 새 버전의 파일을 추가합니다. Hibernate는 스키마를 생성하지 않고 애플리케이션 시작 시 매핑을 검증합니다.
