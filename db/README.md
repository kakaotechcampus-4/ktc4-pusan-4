# DB 스키마

`schema.sql` 한 파일이 전체 스키마다.

## 적용

**로컬 · CI** — 자동이다. `compose.yaml`이 `20-schema.sql`로 마운트해서 컨테이너 최초 기동 시 실행된다.

```bash
docker compose up -d postgres
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

## 마이그레이션 도구가 없는 이유

지금은 스키마가 안 굳었다. 도구를 먼저 넣으면 확정되지도 않은 스키마에 `V1`, `V2`, `V3`를 남발하게 된다.
파일 하나를 고쳐 나가는 편이 낫다.

**언제 도구를 넣는가 — 기준을 미리 정해 둔다.**

> **살아 있는 RDS에 `ALTER TABLE`이 필요해지는 첫 순간에 Flyway를 도입한다.**

그전에는 `schema.sql`을 고치고 로컬 볼륨을 재생성하면 된다.
그 시점이 오면 비용은 `backend/build.gradle.kts` 한 줄 + `schema.sql`을
`backend/src/main/resources/db/migration/V1__init.sql`로 옮기는 것뿐이다. 나중에 넣어도 싸다.

**그때까지 살아 있는 DB에 직접 `ALTER TABLE`을 치지 말 것.** 재현이 안 되는 스키마가 된다.

## 스키마 소유권

`backend`는 `application.yml`에서 `ddl-auto: validate`다. **백엔드는 테이블을 만들지 않는다.**
스키마 소유권이 이 디렉터리에 있다는 뜻이고, 이 설정은 유지해야 한다.

백엔드 부팅이 스키마 불일치로 실패하면 그건 버그가 아니라 **안전장치가 작동한 것**이다.
`schema.sql`을 먼저 맞춰라.

## 테이블

| 테이블 | 용도 |
|---|---|
| `statute_version` | 법령·행정규칙·심판례해석·판례 원문. **append-only** |
| `law_sync_log` | 동기화 실행 기록. 변경이 없어도 한 줄 남긴다 |

`legal_chunk`(임베딩 산출물)는 아직 없다. 청킹·색인 작업 때 추가한다.

`statute_version`을 다룰 때 알아야 할 것:

- **기존 행을 UPDATE 하지 않는다.** 개정 시 옛 행의 `effective_to`를 채우고 새 행을 INSERT 한다.
- `statute_version_current_idx`가 "`statute_id`당 현행 행 최대 1개"를 **DB 레벨에서 강제**한다.
  이 인덱스 위반이 뜨면 적재 로직에 버그가 있는 것이다. 인덱스를 지우지 말고 로직을 고쳐라.
- `body`는 `NOT NULL`이다. 본문 없는 자료(국세청 법령해석, 국세청 출처 판례)는
  수집 대상이 아니며 이 테이블에 들어오지 않는다.
