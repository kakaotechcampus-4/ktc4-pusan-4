# 판정 run 이 거래 한 건에 보내는 쿼리를 줄인다

- 브랜치: refactor/judgment-run-queries
- 커밋: de64585..2dd091f (3개)
- 주요파일: AssignedIdEntity.java, JudgmentCitationRepository.java, StatuteVersions.java, JudgmentReferences.java

## 한 일

- id 를 저장 전에 직접 채우는 `judgment`, `question_queue`, `judgment_run_item` 이 `AssignedIdEntity`(`Persistable`)를 상속한다. 막 만든 객체는 `isNew()` 가 true 라 `save()` 가 merge 대신 persist 로 가서 INSERT 전 SELECT 가 빠진다 (de64585)
- 판정 하나의 인용을 HQL insert-select 한 문장으로 넣는다(`JudgmentCitationRepository.insertAll`). 쓰이지 않게 된 `save` 와 `JudgmentCitationEntity` 생성자를 지웠다 (e2716a4)
- run 과 rejudge 가 작업을 시작할 때 `JudgmentReferences`(공휴일 + `StatuteVersions`)를 만들어 끝까지 쓴다. 조문 버전 기간은 조문마다 처음 인용할 때 `findPeriods` 로 한 번 읽고, 판정일에 유효한 버전은 메모리에서 고른다. `findEffectiveVersionIds` 는 지웠다 (2dd091f)
- 테스트
  - `JudgmentRunQueryCountIntegrationTest`: 27건 run 의 쿼리 수를 Hibernate Statistics 로 센다. 684개(건당 25.3)에서 385개(건당 14.3)가 됐고, 건당 15개 이하로 고정했다
  - `StatuteVersionsIntegrationTest`: effective_from 포함·effective_to 제외 경계, 버전이 없을 때 예외, 한 번 읽은 조문은 그 작업이 끝날 때까지 다시 읽지 않는 것
  - `JudgmentRunInterruptionIntegrationTest`: `judgeItem` 에 references 를 넘기도록 고쳤다
- `docs/architecture.md` 판정 실행(run) 절에 "공휴일과 조문 버전은 run 을 시작할 때 기준으로 판정한다" 를 더했다

## 왜 이렇게 했나

- 인용은 Persistable 대신 insert 한 문장으로 바꿨다. id 가 IDENTITY 라 Hibernate 가 INSERT 를 묶지 못한다. native(`unnest`)나 SEQUENCE 전환 대신 HQL insert-select 를 골라 PostgreSQL 전용 문법과 마이그레이션 없이 한 문장으로 만들었다
- `insertAll` 은 `flushAutomatically = true` 다. 이 쿼리는 judgment 테이블을 건드리지 않아 Hibernate 가 참조하는 judgment INSERT 를 먼저 보내지 않는다
- `in :statuteVersionIds` 는 같은 버전을 두 번 넘겨도 한 행만 넣는다. 원래 `UNIQUE(judgment_id, statute_version_id)` 라 두 번 들어갈 수 없어서 차이가 없다
- 조문 버전은 규칙 카드 목록으로 미리 읽지 않고 처음 인용할 때 읽는다. 질문 응답 effect 에도 인용이 있어 카드 목록만으로는 빠지는 조문이 생긴다
- 서버 전역 캐시 대신 작업 단위로 읽었다. 조문 버전은 주간 법령 동기화로 서버 운영 중에도 바뀌어서, 전역 캐시는 무효화 장치가 필요하다. 작업 단위면 그 작업이 끝날 때 버려진다
- `StatuteVersionsIntegrationTest` 는 전용 조문 ID 를 쓴다. 규칙 카드가 인용하는 조문 행을 닫으면 같은 컨테이너를 쓰는 다른 테스트가 깨진다

## 남은 것 · 아는 문제

- 이미 있는 id 로 새 엔티티를 만들어 `save()` 하면 이제 덮어쓰지 않고 키 중복으로 실패한다. 지금은 세 엔티티 모두 `new` 로 막 만든 객체만 저장한다
- 거래마다 커밋하는 비용, run·item 장부 쿼리, 거래 이중 조회는 그대로다. 잠금 범위와 트랜잭션 경계가 바뀌어 이번에는 건드리지 않았다
- 사용자 사실(user_fact)은 거래마다 그대로 읽는다. run 단위로 읽으면 run 도중 들어온 답변이 남은 거래에 반영되지 않는다

## 01:09 사용자 사실도 run 시작 시점 것으로 판정하고, 쿼리 수 테스트를 바꾼다

- 커밋: 55e7c37..6a842d8 (2개)

### 한 일

- `JudgmentReferences` 에 `BatchUserFacts` 를 더했다. batch 의 최신 UserFact 를 batch 마다 처음 판정할 때 한 번 읽고 작업이 끝날 때까지 쓴다 (55e7c37)
- `StatuteVersionsIntegrationTest` 를 `JudgmentReferencesIntegrationTest` 로 바꾸고, 작업 도중 저장된 UserFact 를 그 작업이 읽지 않는 것을 더했다
- `docs/architecture.md` 판정 실행(run) 절의 스냅샷 설명에 사용자 사실과, run 도중 들어온 답변이 어떻게 되는지를 적었다
- `JudgmentRunQueryCountIntegrationTest` 를 `JudgmentRunReferenceQueriesIntegrationTest` 로 바꿨다. 거래 27건과 54건 run 에서 `public_holiday`, `statute_version`, `user_fact` 를 읽는 SELECT 수가 같은지 본다. SQL 은 Hibernate `StatementInspector` 로 센다 (6a842d8)
- 사용자 사실을 거래마다 읽도록 되돌리면 `user_fact` 27 → 54 로 실패하는 것을 확인했다

### 왜 이렇게 했나

- run 은 문진 버전과 대상 거래를 만들 때 고정하는데 사용자 사실만 거래마다 최신값을 읽어 기준이 섞였다. 앞 기록의 "run 도중 들어온 답변을 반영해야 한다" 는 문서나 코드에 있는 요구가 아니었다. 프론트(`Run.tsx`)는 run 이 끝난 뒤 질문 화면으로 보낸다
- 질문 응답 재판정은 답을 저장한 뒤 references 를 만들어 그 답이 반영된다
- run 전체 쿼리 수 상한은 판정에 기능이 붙어 정당하게 쿼리가 늘어도 깨지고, 되살아난 N+1 이 다른 곳 감소에 가려질 수 있었다. 이번 변경이 지키려는 성질(참조 데이터를 거래 수만큼 읽지 않는다)만 검사한다
- 인용 저장(`insert … select … from statute_version`)은 판정마다 나가는 쓰기라 `select` 로 시작하는 문장만 센다. 조문 버전은 조문마다 한 번 읽으므로 두 run 이 같은 카테고리를 돌게 했다

### 남은 것 · 아는 문제

- run 도중 답변이 들어오면 아직 판정 안 된 같은 그룹 거래에 질문이 다시 생긴다. "지난번 답으로 채우기" 로 채운다
- save 전 SELECT 제거와 인용 한 문장 저장은 이 테스트가 지키지 않는다

## 01:17 run 도중 답변의 복구 방법을 정정한다

- 커밋: 42eeedf (1개)

### 한 일

- `docs/architecture.md` 판정 실행(run) 절에서 "run 도중 들어온 답변으로 다시 생긴 질문은 지난번 답으로 채우기로 채운다" 를 "같은 그룹에 한 번 더 답한다" 로 고쳤다

### 왜 이렇게 했나

- 앞 기록(01:09)의 "지난번 답으로 채우기로 채운다" 는 틀렸다. 지난번 답 불러오기(FR-5, `docs/agent-secretary.md`)는 다른 업로드의 답만 가져온다. 같은 업로드 안에서 run 도중 한 답은 대상이 아니다
- run 도중 답변을 막거나(409) run 이 끝날 때 자동으로 다시 판정하는 방법도 봤다. 정상 흐름에서는 생기지 않고 생겨도 한 번 더 답하면 끝나서 지금 동작을 그대로 두기로 했다(사용자 결정)

## 01:39 조문 버전을 run 시작 때 한 번에 읽는다

- 커밋: 4c381f1 (1개)

### 한 일

- `RuleSet.statuteIds()` 를 더했다. 카드 근거(`RuleCard.citations`)와 질문 선택지 근거(`QuestionSpec.effects → QuestionEffect.citations`)의 조문 ID 를 `RuleSet` 을 만들 때 모은다
- `StatuteVersions` 는 만들 때 그 목록으로 `statute_id in (...)` 를 한 번 읽어 맵을 채운다. 목록에 없는 조문은 인용할 때 읽는다. `findPeriods` 는 조문 ID 묶음을 받는다
- run 과 rejudge 는 `ruleSet.statuteIds()` 로 만들고, 한 건만 저장하는 `JudgmentService.save(command)` 는 빈 목록으로 만들어 인용한 조문만 읽는다
- `JudgmentRunReferenceQueriesIntegrationTest` 를 "거래 27건과 54건 run 모두 표마다 정확히 1번" 으로 바꿨다. 미리 읽기를 끄면 `statute_version` 1 → 14 로 실패하는 것을 확인했다
- `JudgmentReferencesIntegrationTest` 에 시작할 때 읽은 버전을 쓰는 것과 목록 밖 조문을 인용할 때 읽는 것을 나눠 넣었다. `RuleSetTest` 에 조문 ID 모으기를 더했다

### 왜 이렇게 했나

- 조문마다 처음 인용할 때 읽으면 run 도중 법령 동기화가 돌 때 조문별로 읽는 시점이 달랐다
- 앞 기록(오늘 첫 기록)의 "질문 응답 effect 에도 인용이 있어 카드 목록만으로는 빠지는 조문이 생긴다" 는 틀렸다. effect 도 카드의 질문 안에 있어 `RuleSet` 에서 모두 뽑을 수 있다
- 조문 ID 목록은 카드와 같이 기동할 때, 버전 기간은 run 마다 읽는다. 버전까지 기동할 때 읽으면 법령 동기화 뒤에도 다음 배포까지 옛 버전으로 판정한다
- 목록 밖 조문을 인용할 때 읽는 길은 남겼다. 엔진이 인용을 가져오는 곳이 늘어도 판정은 실패하지 않고, 참조 데이터 조회 테스트가 그 어긋남을 잡는다
