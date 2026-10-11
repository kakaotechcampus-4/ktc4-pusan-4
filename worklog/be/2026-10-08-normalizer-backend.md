# 정규화기를 engine/ 에서 backend 로 옮긴다 (B3a)

- 브랜치: feature/normalizer-backend
- 커밋: 1개
- 주요파일: T1Normalizer.java, NormalizeSpecLoader.java, T1NormalizerRulesTest.java, NormalizeSpecLoaderTest.java

## 한 일

- `engine/.../t1/T1Normalizer`·`T1Result` 를 `backend/.../merchant/normalize/` 로 옮겼다(git mv, 로직 변경 없음).
- `NormalizeSpecLoader` 를 새로 뒀다. 파이썬 `load()` 와 같이 `rules/normalize.yaml` 을 읽고
  - `rules/pg_blocklist.yaml` 의 `match` 목록을 `split_delimiters.pg_hints` 에 넣는다(비거나 없으면 normalize.yaml 값).
  - `resolve_brand` 단계의 `dict`(`brands.yaml`) 를 읽어 `brands` 에 넣는다.
- 테스트: `T1NormalizerRulesTest`(normalize.yaml `test_cases` 50건, `brand_layer1.yaml` 20건을 동적 테스트로),
  `NormalizeSpecLoaderTest`(브랜드·PG 힌트 주입, pg_blocklist 없음·빈 목록).
- `engine/` 을 지웠다(`T1Cli`, `MiniYaml` 포함). `README_T1.md` 는 새 패키지 `README.md` 로 옮기고 낡은 절을 정리했다.
- backend CI paths 와 Gradle test 입력에 `tools/fixtures/**`(와 `../rules`) 를 더했다.
- normalize.yaml·normalize.py·brand fixture 주석과 계획표 B3a 줄, worklog 스킬의 도메인 표에서 engine/T1Cli 언급을 고쳤다.

## 왜 이렇게 했나

- 복사하면 Java 구현이 둘(engine·backend) + 파이썬으로 세 벌이 된다. engine/ 은 빌드·CI 가 없어 아무도 안 돌린다(#79).
  backend CI 는 `rules/**` 가 바뀔 때마다 돌므로, 같은 파일을 읽는 테스트를 backend 로 옮기면 #79 가 함께 닫힌다.
- brands.yaml 주입은 해석기가 아니라 `T1Cli` 에 있었다. 해석기만 옮기면 브랜드 단계가 빈 사전으로 돈다.
- engine 은 pg_hints 를 normalize.yaml 에 박힌 목록으로 썼고 파이썬은 pg_blocklist.yaml 로 덮어썼다.
  로더를 파이썬과 맞춰 이 갈라짐을 없앴다(README 의 구글플레이 사례).
- YAML 은 `RuleCardLoader` 와 같이 Jackson YAML 로 읽는다. 대상 4개 파일은 YAML 1.1(PyYAML)·1.2 로 읽은 결과가 같아 해석 차이가 없다.

## 확인한 것

- 파이썬과 같은 입력 3,460건(test_cases·fixture·평가셋 가맹점·브랜드 표기 변형·docs 표의 상호 등)을 21필드 대조:
  옮기기 전 engine 은 47건이 달랐고(pg_hints 출처), 옮긴 뒤는 2건(아래 알려진 문제)만 다르다.
- 대조는 작업 환경에서 SnakeYAML 로 읽어 돌렸다(Gradle 불가). Jackson 로더와 JUnit 은 로컬 `./gradlew test` 로 확인해야 한다.

## 남은 것 · 아는 문제

- KS X 1001 밖 한글(`똠` 등)의 절단 바이트를 파이썬은 8, 자바는 1로 센다. CP949 기준 2라 둘 다 틀리다.
  normalize.yaml `encoding: cp949` 로 바꾸면 맞지만 규칙 변경이라 따로 제안한다.
- 서버 기동 시 빈 등록과 rules 경로 설정은 실제로 호출하는 B3b 에서 붙인다.
