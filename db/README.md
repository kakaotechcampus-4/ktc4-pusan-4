# DB 스키마

스키마 소유권이 둘로 나뉜다.

| 소유 | 무엇 | 어디 |
|---|---|---|
| **백엔드 Flyway** | `statute_version` 등 판정 코어 | `backend/src/main/resources/db/migration/V*.sql` |
| **이 디렉터리** | `law_sync_log` | `db/schema.sql` |

`statute_version`이 `judgment_citation.statute_version_id`의 FK 대상이라 저쪽이 만든다.
양쪽이 같이 만들면 initdb가 먼저 돌아 Flyway가 "이미 존재한다"로 실패하고 앱이 안 뜬다.

## 적용

**순서가 있다.** Flyway가 먼저다.

```bash
docker compose up -d postgres          # 1) 확장 + law_sync.sql
./gradlew :backend:bootRun             # 2) Flyway 마이그레이션 (또는 아래 수동 적용)
```

백엔드를 띄우지 않고 AI 쪽만 작업할 때는 V1을 직접 넣는다.

```bash
docker exec -i <postgres> psql -U ktc4 -d ktc4   < backend/src/main/resources/db/migration/V1__create_judgment_core.sql
```

> ⚠️ `docker-entrypoint-initdb.d`는 **데이터 디렉터리가 비어 있을 때만** 실행된다.
> 이미 뜬 컨테이너에 스키마를 다시 넣으려면 볼륨을 지우거나 `psql`로 직접 적용해야 한다.
> ```bash
> docker compose down -v && docker compose up -d postgres   # 볼륨 삭제 후 재생성
> ```

**RDS** — 1회 수동 적용한다.

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

## 확장(extension)은 여기 없다

`vector`, `pg_bigm` 설치는 `docker/postgres/init.sql`이 `10-extensions.sql`로 먼저 적용한다.
확장은 **이미지 특성**이고 스키마는 **애플리케이션 자산**이라 분리해 둔다.

RDS에서는 확장이 자동으로 안 깔린다. 먼저 확인할 것:

```sql
SHOW rds.extensions;                        -- 가용 목록
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_bigm;
```

## 마이그레이션은 Flyway가 한다

판정 코어 테이블은 `V1`, `V2`, ... 로 쌓는다. **살아 있는 DB에 직접 `ALTER TABLE`을 치지 말 것.**
재현이 안 되는 스키마가 된다.

`law_sync_log`만 여기 남았고 아직 마이그레이션 번호가 없다.
이 테이블에 `ALTER TABLE`이 필요해지면 그때 Flyway로 옮긴다.

## ddl-auto: validate

`backend`는 `application.yml`에서 `ddl-auto: validate`다. **JPA는 테이블을 만들지 않는다.**
만드는 건 Flyway고 JPA는 대조만 한다. 이 설정은 유지해야 한다.

백엔드 부팅이 스키마 불일치로 실패하면 그건 버그가 아니라 **안전장치가 작동한 것**이다.
`schema.sql`을 먼저 맞춰라.

## 테이블

| 테이블 | 용도 |
|---|---|
| `statute_version` | 법령·행정규칙·심판례해석·판례 원문. **append-only**. *Flyway 소유* |
| `law_sync_log` | 동기화 실행 기록. 변경이 없어도 한 줄 남긴다 |

`legal_chunk`(임베딩 산출물)는 아직 없다. 청킹·색인 작업 때 추가한다.

`statute_version`을 다룰 때 알아야 할 것:

- **기존 행을 UPDATE 하지 않는다.** 개정 시 옛 행의 `effective_to`를 채우고 새 행을 INSERT 한다.
- `statute_version_current_idx`가 "`statute_id`당 현행 행 최대 1개"를 **DB 레벨에서 강제**한다.
  이 인덱스 위반이 뜨면 적재 로직에 버그가 있는 것이다. 인덱스를 지우지 말고 로직을 고쳐라.
- `trg_statute_version_append_only` 트리거가 `body`·`meta` 등 내용 컬럼의 UPDATE를 막는다.
  `effective_to`·`is_superseded`만 열려 있어 버전 닫기는 통과한다.
  시행일이 같은데 본문만 다른 원문 정정은 표현할 방법이 없어 적재가 건너뛴다.
- `body`는 `NOT NULL`이다. 본문 없는 자료(국세청 법령해석, 국세청 출처 판례)는
  수집 대상이 아니며 이 테이블에 들어오지 않는다.
