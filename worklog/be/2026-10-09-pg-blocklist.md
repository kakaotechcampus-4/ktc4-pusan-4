# PG 차단 부품(T2)을 backend 에 둔다

- 브랜치: feature/pg-blocklist (feature/normalizer-backend 위, #111 선행)
- 커밋: 1개
- 주요파일: PgBlocklist.java, PgBlockResult.java, PgBlocklistRulesTest.java, tools/fixtures/pg_block.yaml

## 한 일

- `backend/.../merchant/pg/PgBlocklist`·`PgBlockResult` 를 새로 뒀다. `rules/pg_blocklist.yaml` 을 실행하는 순수 컴포넌트다(스프링·DB 의존 없음).
  - 입력은 정규화 결과 `T1Result`. 토큰(`lookupUnits()`) 단위 대소문자 무시 검사 → 하나도 안 걸리면 원문 재검사 →
    남은 토큰을 힌트와 구조 토큰으로 나눔 → 차단이면 `on_match` 의 `category`(PG_미상)·`seed_insert`.
  - 파이썬 `PGBlocklist.check` 와 같은 규칙이다. `needs_review` 는 옮기지 않았다.
- 구조 토큰 목록(`GENERIC_TOKENS`·`GENERIC_TOKEN_PAT`)을 `tools/normalize.py` 상수에서 `rules/pg_blocklist.yaml` 의 `hint_ignore` 로 옮겼다.
  - `pg_block.py` 는 자기 스펙의 `hint_ignore` 를, `normalize.py` 는 import 때 같은 파일을 읽는다(리포트 익명화·키 갈림 표).
- 공통 fixture `tools/fixtures/pg_block.yaml` 15건(합성 상호). 파이썬 `pg_block.py --fixture` 와 Java `PgBlocklistRulesTest` 가 같은 파일을 읽는다.
  - 덮는 경로: 토큰 하나만 PG / 전부 PG / 분해 안 된 문자열 / 정규화가 PG 를 지워 원문 재검사 / 구조 토큰 / 대소문자 / PG 아님 / '다날' 오탐 경계 / 패턴이 구분자로 갈리는 한계.
  - backend CI paths 와 Gradle test 입력은 #111 에서 이미 `tools/fixtures/**` 를 본다. 추가 변경 없음.

## 왜 이렇게 했나

- 입력을 원문이 아니라 `T1Result` 로 받는다. 파이썬이 T1 토큰 단위로 판정하고, 토큰 단위여야 "어느 토큰이 PG 이고 어느 토큰이 서비스명인지" 힌트가 남는다. 원문을 받으면 분해를 다시 해야 한다.
- 구조 토큰을 Java 에 복사하면 세 번째 사본이 된다. 규칙 파일 하나를 두 구현이 읽는 방식(#111 의 pg_hints·brands 와 같다)으로 맞췄다.
- `needs_review` 를 결과에서 뺐다. 백엔드에서 되묻기는 PG_미상 카드(R-105)가 한다. 같은 이름의 거래 컬럼(classification_status)과 섞이지 않게 했다.

## 확인한 것

- 파이썬 기존 결과 불변: 실데이터 338행의 PG 판정·키워드 파이프라인 결과, 정규화·PG·키워드룰 리포트 세 개가 옮기기 전과 글자 단위로 같다.
- 파이썬 selftest 50/50, brand fixture 20/20, keyword 11/11, validate_rules errors=0, pg fixture 15/15.
- Java `merchant.*` 92건 통과(PgBlocklistRulesTest 18 = fixture 15 + 단위 3).
- 실데이터 338행을 Java 로도 돌려 파이썬과 대조: 차단 19행 포함 전 행이 6필드(blocked·pg_tokens·hint·dropped·matched·category) 일치. 대조 파일은 data/ 에만 두고 커밋하지 않았다.
- 로컬 Gradle 테스트는 사용자 경로의 한글 때문에 테스트 워커가 뜨지 않아, ASCII 경로 worktree + GRADLE_USER_HOME 으로 돌렸다.

## 남은 것 · 아는 문제

- B3b 에서 정할 것(PR 본문에 권고로 적음): PG 차단 순서(사전보다 앞), PG_미상 분류 상태(CLASSIFIED + R-105), B8 이 PG 건을 사전에 쓰지 않음.
- 알려진 한계 두 가지를 fixture 로 고정했다. '다날' 이 다른 글자 사이에 있어도 걸리고(open_questions 의 '그대로 둔다'), 패턴이 구분자로 갈리면(`NHN-KCP`) 못 잡는다.
- 정규화가 'OO페이점' 을 지점명으로 지우는 경우가 있다. 원문 재검사로 차단은 되지만 힌트는 남지 않는다.
