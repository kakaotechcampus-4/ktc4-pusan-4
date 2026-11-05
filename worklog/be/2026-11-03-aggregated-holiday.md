# 카드사 합산 행을 주말·공휴일 카드에서 뺀다 (#192)

- 브랜치: fix/aggregated-holiday (develop eebd836 에서 시작)
- 커밋: f202b29 (1개)
- 주요파일: JudgmentEngine.java, TransactionInput.java, TransactionRecordEntity.java, docs/rule-card-fields.md

## 한 일

- 판정 입력 `TransactionInput` 에 `aggregated` 를 더하고, `TransactionRecordEntity.toInput()` 이 `is_aggregated` 를 넘긴다. 기존 생성자는 남기고 기본값은 false 다.
- `JudgmentEngine` 의 `holiday: true` 매칭이 합산 행이면 매칭하지 않는다. 합산 교통 행은 평일 여비교통(R-208)으로 업무 목적을 묻는다.
- `docs/rule-card-fields.md` 의 `holiday` 설명에 합산 행 예외를 적었다.

## 왜 이렇게 했나

- 이슈가 낸 두 안(엔진에서 제외 / 주말 카드 조건에서 제외) 중 엔진을 골랐다. 카드 쪽 안도 match 에 합산 여부 조건이 없어 엔진 작업이 필요하고, 판정 입력에 합산 여부가 아예 없었다.
- `docs/schema_mapping.md` 가 합산 행을 "판정대상, 여비교통 후보"로 정해 두어, 판정에서 빼지 않고 요일 규칙만 뺀다.

## 확인한 것

- 엔진 단위 테스트(토요일 합산 행에 휴일 카드가 붙지 않음)는 실패를 본 뒤 고쳤다.
- 통합 테스트(실제 카드로 2026-01-31(토) 합산 지하철 → R-208, 확인 필요)는 `toInput()` 에서 합산 여부를 끊으면 R-314·불가로 실패하는 것을 보고 되돌렸다.
- 처음엔 `JudgmentExecutorIntegrationTest` 에 두며 공통 준비에 소득세법-27-1 을 넣었는데, 조문 누락을 보는 기존 테스트가 깨졌고 테스트 안에서 넣어도 같은 DB 를 써서 순서에 따라 깨질 수 있었다. 이미 그 조문을 넣는 `QuestionAnswerIntegrationTest` 로 옮겼다.
- `gradlew -p backend check` 통과(unit 410, integration 280, 건너뜀 4 은 벤치마크). `tools/validate_rules.py` errors 0.

## 남은 것 · 아는 문제

- 평가셋(`eval/cases/`)에는 합산 행 케이스가 없다. 카드·평가셋 담당이 추가할지 정할 일이다.
