# 판정 대상 조건을 TransactionConditions 로 모으고 QueryDSL 을 들인다 (#162)

- 브랜치: refactor/judgment-target-querydsl (#234 perf/limit-settlement-on-answer d78b5e6 위)
- 커밋: 2af9904..12d1eb2 (12개)
- 주요파일: TransactionConditions.java, TransactionQueryRepositoryImpl.java, JudgmentRepositoryCustomImpl.java, build.gradle.kts

## 한 일

- QueryDSL(OpenFeign 포크 6.12)과 `JPAQueryFactory` 빈을 들였다.
- "지금 판정 대상" 조건을 `TransactionConditions` 로 모았다. 규칙 원본은 `TransactionDetail.effectiveStatus` 하나이고, 쿼리 조건은 이 함수에 9가지 입력(sourceStatus 3 × userInclusion 3)을 넣어 보고 뽑아낸다. `TransactionRecordEntity.judgeable()` 도 이 함수를 쓴다.
- 조건을 쓰던 JPQL 9개를 리포지토리 6개의 `XxxRepositoryCustom` + `XxxRepositoryCustomImpl` 로, 네이티브 거래 목록 1개를 QueryDSL 로 옮겼다. 호출하는 쪽은 그대로다.
- `TransactionConditionsIntegrationTest`(16조합)를 더했다. 이관 전에 조건이 빠져도 실패하지 않던 4곳(진행 상황 분류 대기, 거래를 지정한 판정 목록, 한도 집계·질문 목록의 미분류 제외)에 테스트를 먼저 더했다.
- `backend/README.md` 에 `@Query` 와 QueryDSL 을 고르는 기준을 적었다.

## 왜 이렇게 했나

- 같은 조건이 12곳(JPQL 9, 네이티브 1, Java 2)에 복사돼 있었고, 하나를 빠뜨려도 잡히지 않았다. 실제로 반복된 버그는 새 쿼리가 조건을 빠뜨린 쪽이었다(ee37bf0, 6d175a1, 263120f).
- 문자열 상수, DB 계산 컬럼, JPA Criteria 와 견줬다.
  - 문자열 상수는 별칭을 맞춰야 한다는 숨은 약속이 생긴다.
  - 계산 컬럼은 같은 행 값으로만 계산할 수 있어 "현재 판정" 같은 반복 조건으로 넓힐 수 없다.
  - Criteria 는 조인·집계·DTO 프로젝션 쿼리에서 읽기가 크게 나빠진다.
- 프로젝트를 계속 키운다는 전제로 QueryDSL 을 쿼리 도구로 들이고, #162 를 첫 적용 지점으로 삼았다.
- 규칙을 쿼리에 한 번 더 적고 테스트로 묶는 안 대신 사본을 없애는 쪽을 골랐다. 쿼리만 읽어서는 규칙이 안 보이므로 이유와 생성 SQL 을 클래스 주석에 적었다.
- 처음에는 userInclusion 을 `in (목록)` 으로 걸었다. 목록 파라미터가 있으면 Hibernate 가 실행마다 SQL 로 다시 옮겨 호출마다 1ms 안팎이 더 들었고(DB 시간은 같음), 질문 답이 15~50ms 느려졌다. `=` 를 or 로 이었다.

## 확인한 것

- `gradlew -p backend check` 통과(테스트 706, 실패 0, 건너뜀 7 은 환경변수로 도는 벤치마크).
- 조합 테스트는 뽑는 코드를 일부러 틀리게 해서 실패하는 것을 봤다. `findPage` 의 거래 지정 예외도 일부러 깨서 새 테스트가 잡는 것을 봤다.
- 벤치마크(Testcontainers PG17)를 이관 전·후 번갈아 2번씩 돌렸다. run 3,000건 64.7s·65.7s → 60.1s·64.7s, summary·export 는 비슷하거나 빠름, 질문 답 1건 평균 58~64ms → 63~74ms.
- 가맹점 재판정 대상 조회를 같은 데이터에서 옛 JPQL 과 300번씩 번갈아 부르면 DB 실행 시간은 같다(0.5ms 안팎).

## 남은 것 · 아는 문제

- 질문 답의 5ms 안팎 차이는 측정 흔들림 수준이고 원인을 따로 찾지 못했다. 이 PC 에서는 같은 코드도 run 이 56~112초로 흔들린다.
- Q클래스가 JaCoCo 커버리지(`codeHealthReports`)에 섞이는지 확인하지 못했다. `QuestionQueueEntity` 처럼 Q 로 시작하는 실제 클래스가 있어 `Q*` 제외는 쓸 수 없다.
- 다른 쿼리의 목록 파라미터(`in :ids`)도 같은 재변환 비용이 있다. 이번 범위에서는 판정 대상 조건만 바꿨다.
- #234 가 머지되면 develop 을 합치고 PR base 를 develop 으로 바꿔야 한다.
