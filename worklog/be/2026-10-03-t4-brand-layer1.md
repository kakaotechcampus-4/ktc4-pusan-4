# T4 1단계 — 브랜드 1겹 + norm_key 문자열 기준

- 브랜치: feature/t4-brand-layer1
- 커밋: 4a238dc (1개)
- 주요파일: `tools/normalize.py`, `engine/.../T1Normalizer.java`, `rules/brands.yaml`, `rules/normalize.yaml`

## 한 일

- norm_key 를 항상 문자열로 정한다(#22 A안). 사업자번호는 `biz_no` 필드로 남긴다.
  트랙은 overseas · string 둘이고 키가 아니라 라벨이다.
- `rules/brands.yaml`(시드 30개, category 비움)과 `resolve_brand` 단계를 추가했다.
  `upper_ascii` 뒤, `strip_branch` 앞이다. 맞으면 `strip_branch` 를 건너뛴다.
- 절단 판정을 넓혔다. 닫히지 않은 괄호는 절단 확정, 19바이트는 의심만 남기고
  `resolve_brand` 가 사전과 맞을 때만 확정한다.
- Python·Java 를 같이 바꿨다. 사전은 로더가 단계에 주입한다(`inject_brands` /
  `T1Cli.injectBrands`). Java `T1Result` 에 `bizNo`·`brandKey`·`brandRestored`·
  `branch`·`branchRaw` 를 추가했다.
- `tools/fixtures/brand_layer1.yaml` — 1층 표의 합성 예시. 양쪽이 같은 파일로 검사한다
  (`normalize.py --fixture` / `T1Cli --fixture`).
- `validate_rules.py` 가 정규화기를 만들 때 사전을 주입하도록 했다(안 그러면 브랜드
  test_case 가 실패한다). `analyze_unclassified.py` 의 합성 selftest 를 A안 의미로 고쳤다 —
  같은 상호는 사업자번호 유무와 무관하게 한 행으로 모인다.

## 왜 이렇게 했나

- #22 가 수정 없이 닫혀 있었다. A안이 Python·Java 어디에도 없어서, 1겹 사전을 만들어도
  사업자번호 트랙(스냅샷 25행 중 23행)에서는 키가 바뀌지 않는다. 그래서 같이 처리했다.
- 단어 경계는 처음에 "영숫자 뒤 영숫자" 로 막았는데, 점포번호가 붙은 `이마트24` 가
  막혀 버렸다. CU 와 CUTE 를 가르는 게 목적이라 "영문 뒤 영문" 으로 좁혔다.
- 1층 표 예시 `가나다마트익스프레스` 는 정확히 20바이트라 절단 규칙(8행)이 먼저 걸린다.
  하위 업태는 사전에 별도 브랜드로 등록해야 지켜진다 — fixture 를 그렇게 바꿨다.

## 남은 것 · 아는 문제

- 사전에 없는 하위 업태 뒤에 지점명이 붙으면(○○익스프레스 해운대점) 뒤가 지점 모양이라
  부모 브랜드에 붙는다. 하위 업태는 사전에 넣어야 한다.
- 19바이트 + 사전 일치를 절단으로 확정하는 규칙대로, 실데이터의 온전한 GS25 이름 2건이
  is_truncated=True 로 표시된다. 키(GS25)는 같아 분열에는 영향이 없다.
- `analyze_unclassified.py` 의 키 분열 지표(string_norm -> norm_key 1:N)는 A안 이후
  구조적으로 0 이 된다. 브랜드 단위 분열을 재는 지표가 따로 필요하다.
- Python·Java pg_hints 출처 분기(README_T1)는 그대로다. 21필드 대조의 불일치 16행이 이것.
- DB 테이블·되묻기 묶음 단위(scopeKey)·user_fact 는 2단계.

## 02:55 리뷰 요청 전 보완

- 커밋: 2d6d98e
- GS더프레시를 GS25 와 다른 브랜드로 사전에 추가했다.
- fixture 하위 업태 예시를 20바이트 미만(가나다마트프레시)으로 바꿨다. "사전에 없는 하위 업태는
  뒤에 지점이 붙으면 부모 브랜드에 붙는다" 를 확정 사항으로 fixture 에 고정했다.
- 19바이트 절단 확정을 "이름이 사전 브랜드 중간에서 끝날 때(브랜드 앞부분만 일치)" 로 좁혔다.
  브랜드 전체가 들어 있으면 의심으로 두고 일반 매칭으로 간다. 앞 절에 적은 온전한 GS25 2건이
  is_truncated=False 가 됐다. Python·Java 같이 바꿨고 fixture 20/20 양쪽 통과.
- `analyze_unclassified.py` 에 사업자번호 분열 지표(같은 사업자번호 -> norm_key 1:N)를 추가했다.
  develop 0 -> 이 브랜치 1(3거래). A안 전에는 사업자번호가 키라 구조적으로 0 이었다.
  1건은 같은 사업장의 절단 표기 차이다 — A안이 키에서 사업자번호를 빼면서 생긴 비용이다.
- engine/ CI 부재를 #79 로 올렸다.
