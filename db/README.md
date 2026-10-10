# DB 스키마

스키마 소유권이 둘로 나뉜다.

| 소유 | 무엇 | 어디 |
|---|---|---|
| **백엔드 Flyway** | `statute_version` 등 판정 코어 | `backend/src/main/resources/db/migration/V*.sql` |
| **이 디렉터리** | `law_sync_log` | `db/schema.sql` |
| **이 디렉터리** | `legal_chunk` (RAG 색인) | `db/rag.sql` |

`statute_version`이 `judgment_citation.statute_version_id`의 FK 대상이라 저쪽이 만든다.
양쪽이 같이 만들면 initdb가 먼저 돌아 Flyway가 "이미 존재한다"로 실패하고 앱이 안 뜬다.

## 적용

**순서가 있다.** Flyway가 먼저다.

```bash
docker compose up -d postgres          # 1) 확장 + law_sync.sql
./gradlew :backend:bootRun             # 2) Flyway 마이그레이션 (또는 아래 수동 적용)
docker compose exec -T postgres psql -U ktc4 -d ktc4 < db/rag.sql   # 3) legal_chunk
```

`rag.sql`은 **initdb에 마운트하지 않는다.** `statute_version`을 FK로 걸어서, Flyway보다
먼저 도는 initdb 단계에서는 참조 대상이 없어 `CREATE TABLE`이 실패하고 컨테이너가 죽는다.

운영 배포(`deploy/deploy.sh`)는 Flyway 뒤에 두 파일을 각각 `psql -1`(한 트랜잭션)로 적용하고,
매 배포마다 다시 실행한다. 그래서 두 파일은 재실행해도 결과가 같아야 하고(`IF NOT EXISTS`),
`CREATE INDEX CONCURRENTLY`처럼 트랜잭션 안에서 못 도는 문을 넣으면 배포가 실패한다.

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

### 이전 코드와 호환되게 쓴다

운영에서 앱을 이전 이미지로 롤백해도 **스키마와 데이터는 되돌리지 않는다.** 새 버전이 바꾼 스키마와
새 버전이 쓴 행 위에서 바로 이전 버전 코드가 그대로 돌아야 한다. 무중단 배포에서는 배포 도중
두 버전이 같은 DB를 동시에 쓰므로 롤백이 없어도 같은 조건이다.

이전 코드는 두 곳에서 깨진다. `ddl-auto: validate`는 엔티티의 컬럼이 있는지와 타입만 대조하므로
제약조건·`NOT NULL` 위반은 부팅을 통과한 뒤 요청 처리 중에 드러난다.

| 변경 | 이전 코드가 깨지는 곳 | 이렇게 한다 |
|---|---|---|
| 기본값 없는 `NOT NULL` 컬럼 추가 | 실행 중. 이 컬럼을 모르는 INSERT가 실패한다. 행이 있는 테이블이면 마이그레이션도 실패한다 | nullable로 두거나 `DEFAULT`를 붙인다. `V4`가 이 형태고 `V5`처럼 쓴다 |
| 컬럼·테이블 삭제, 이름 변경, 타입 변경 | 부팅. `validate`가 옛 컬럼이나 타입을 찾지 못한다 | 새 컬럼 추가 → 코드 전환 배포 → 다음 배포에서 옛 컬럼 삭제로 나눈다 |
| `CHECK`·`UNIQUE`·FK 추가 | 실행 중. 이전 코드가 제약을 모르고 어기는 값을 쓴다 | 이전 코드가 쓰는 값이 제약을 지키는지 먼저 확인한다 |
| 문자열 컬럼에 새 값 쓰기 (예: `verdict`에 새 enum 값) | 실행 중. 이전 코드가 그 행을 읽어 자기가 아는 값으로 바꾸다 실패한다. 스키마 변경이 없어도 생긴다 | 읽는 쪽이 새 값을 견디는 코드를 먼저 배포한 뒤 쓰기 시작한다 |
| 마이그레이션 안의 `UPDATE`로 값의 의미 변경 (단위, 형식) | 실행 중. 에러 없이 틀린 값을 낸다 | 새 컬럼에 변환한 값을 넣고, 옛 컬럼은 위의 삭제 순서를 따른다 |

이미 적용된 `V*.sql`은 고치지 않는다. 바꿀 게 있으면 새 번호를 쓴다.

AI 파이프라인(`ai/pipeline/`)은 `statute_version` 같은 Flyway 테이블을 SQL로 직접 읽고 쓴다.
부팅 시 대조가 없어 위 변경이 주간 코퍼스 동기화 때에야 실패로 드러나므로, AI가 쓰는 테이블도
같은 규칙을 따른다.

마이그레이션 하나는 트랜잭션 하나라 중간에 실패하면 통째로 취소된다.
`CREATE INDEX CONCURRENTLY`처럼 트랜잭션 안에서 못 도는 문은 이 보호를 받지 못한다.

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
| `legal_chunk` | 재색인 산출물. 규칙 후보 초안·보고서 생성 전용이고 **판정 경로는 쓰지 않는다** |

`legal_chunk`는 `statute_version`에서 파생된다. 원본이 아니므로 통째로 지우고 다시 만들어도 된다.
증분 재색인은 `source_hash`(= `statute_version.body_hash` 복사본) 비교로 판단한다.

`statute_version`을 다룰 때 알아야 할 것:

- **기존 행을 UPDATE 하지 않는다.** 개정 시 옛 행의 `effective_to`를 채우고 새 행을 INSERT 한다.
- `statute_version_current_idx`가 "`statute_id`당 현행 행 최대 1개"를 **DB 레벨에서 강제**한다.
  이 인덱스 위반이 뜨면 적재 로직에 버그가 있는 것이다. 인덱스를 지우지 말고 로직을 고쳐라.
- `trg_statute_version_append_only` 트리거가 `body`·`meta` 등 내용 컬럼의 UPDATE를 막는다.
  `effective_to`·`is_superseded`만 열려 있어 버전 닫기는 통과한다.
  시행일이 같은데 본문만 다른 원문 정정은 표현할 방법이 없어 적재가 건너뛴다.
- `body`는 `NOT NULL`이다. 본문 없는 자료(국세청 법령해석, 국세청 출처 판례)는
  수집 대상이 아니며 이 테이블에 들어오지 않는다.
