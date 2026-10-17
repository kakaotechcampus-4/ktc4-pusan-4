# 가맹점 분류기를 backend 에 둔다 (B3b)

- 브랜치: feature/merchant-classifier
- 커밋: 1개
- 주요파일: RuleBasedMerchantClassifier.java, KeywordRules.java, MerchantClassifierConfiguration.java, MerchantDictionaryRepository.java

## 한 일

- `merchant/classify/` 를 새로 뒀다. 순서는 PG 차단 → 개인 사전 → 전역 사전 → `keyword_rules.yaml` → `미분류` 다.
  - `MerchantClassifier.classifyAll(userId, inputs)` 는 목록 단위다. 결과는 입력과 같은 순서·길이이고, 단계(`ClassificationStage`)·normKey·걸린 룰·힌트를 담는다.
  - `KeywordRules` 는 파이썬 `KeywordRules.classify` 와 같은 규칙이다(원문·정규화 문자열 양쪽 검사, priority → 패턴 길이 → 파일 순서).
  - `MerchantDictionaryRepository.findAll(userId, patterns)` 를 더했다. 개인·전역 행을 쿼리 한 번으로 가져오고, 어느 쪽이 이기는지는 분류기가 정한다.
- `MerchantClassifierConfiguration` 이 정규화기·PG·키워드룰·분류기를 빈으로 등록한다. 규칙 경로는 `app.rules.dir`(기본 `../rules`), 컨테이너는 `RULES_DIR=/app/rules`.
- 테스트: `KeywordRulesTest`(yaml `test_cases` + 단위 6), `RuleBasedMerchantClassifierTest`(가짜 사전으로 단계 순서 11), 통합 테스트 2(`findAll` 개인·전역·타인 분리, 기동 시 분류기 빈 로드).

## 왜 이렇게 했나

- PG 를 사전보다 앞에 둔다. PG 명의가 사전에 들어가면 그 PG 를 거친 결제가 전부 같은 카테고리로 굳는다(`seed_insert: false`). PG 거래는 사전을 조회하지도 않는다.
- 사전은 normKey 정확 일치다. 지점이 달라도 같은 키가 나오므로 한 줄이 모든 지점을 받는다. B8 은 분류 검토 응답을 같은 값으로 개인 사전에 쓴다.
- uncertain 룰은 분류가 아니라 힌트다. 미분류로 두고 힌트만 남긴다.
- 목록 단위로 둔 이유: 사전 조회를 `IN` 쿼리 한 번으로 묶고, B10 에서 미분류만 모아 분류 API 를 한 번 부를 자리를 남긴다.
- 규칙 파일은 기동할 때 읽는다. YAML 이 깨지면 첫 업로드가 아니라 기동이 실패한다.

## 확인한 것

- 작업 환경에서 Maven Central·Gradle 배포 서버가 막혀 `./gradlew test` 를 못 돌렸다. 대신 YAML 을 PyYAML 로 읽어 넘기는 하네스로 JUnit 단언을 옮겨 돌렸다: 31/31 통과.
- 파이썬 `keyword_rules.pipeline` 과 대조: rules·fixture·평가셋·해외 SaaS 셋·브랜드 변형에서 모은 상호 1,083건(PG 32·키워드 245·미분류 806)이 단계·카테고리·normKey·힌트 전부 일치.

## 남은 것 · 아는 문제

- JUnit·통합 테스트(Testcontainers)는 로컬 `./gradlew test integrationTest` 로 확인해야 한다.
- 분류 결정(10/16)에서 사전·키워드룰을 AI 서버로 옮기기로 하면 이 PR 의 범위가 바뀐다.
- 해외 SaaS 사전(PR #73)·상권정보 매칭(PR #61)은 아직 단계에 없다. 위 결정에 따라 붙인다.

## 리뷰 반영 (10/17, PR #124)

- develop 위로 리베이스했다. `application.yml` 충돌은 develop 에 이미 있는 `app.rules` 블록을 쓰고, 이 PR 이 넣었던 `RULES_DIR` 환경변수는 `APP_RULES_DIR` 로 대체돼 지웠다.
- `match` 나 `category` 가 없는 키워드룰은 규칙을 읽을 때 실패시킨다. `match` 가 비면 빈 패턴이 모든 문자열에 걸려 그 priority 아래 룰을 전부 가로챈다(유렬 리뷰). 지금 `keyword_rules.yaml` 68개 룰은 모두 둘 다 있다.
