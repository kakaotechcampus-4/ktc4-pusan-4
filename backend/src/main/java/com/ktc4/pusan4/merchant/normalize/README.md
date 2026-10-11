# T1 정규화 해석기 (Java)

`rules/normalize.yaml`을 읽어서 실행한다. 규칙은 이 코드에 없다.
파이썬 `tools/normalize.py`와 같은 파일을 읽고, 문자 단위로 같은 결과를 내야 한다.

| 파일 | 역할 |
| --- | --- |
| `T1Normalizer.java` | 해석기. YAML 의 `steps` 이름에 해당하는 동작만 제공한다. 스프링에 의존하지 않는다 |
| `T1Result.java` | 결과 record. 파이썬 `Result` 와 필드 1:1 대응 |
| `NormalizeSpecLoader.java` | 스펙 로더. 파이썬 `load()` 와 같이 `pg_blocklist.yaml` 의 `match` 를 `pg_hints` 로, `brands.yaml` 을 `resolve_brand` 에 넣는다 |

```java
T1Normalizer normalizer = new T1Normalizer(new NormalizeSpecLoader().load(Path.of("rules")));
T1Result r = normalizer.normalize("스타벅스코리아 강남대로점", bizNo);
```

## 검증

```bash
cd backend && ./gradlew test --tests "com.ktc4.pusan4.merchant.normalize.*"
```

`T1NormalizerRulesTest` 가 파이썬과 같은 파일, 같은 기대값을 검사한다.
`rules/**`·`tools/fixtures/**` 가 바뀌면 backend CI 가 다시 돌린다.

| | `test_cases` (합성) | 실측 상호 대조 |
|---|---|---|
| 어디 있나 | `rules/normalize.yaml`, `tools/fixtures/brand_layer1.yaml` | 고정 테스트 없음. 이전할 때 손으로 돌렸다 |
| 무엇을 지키나 | **규칙이 만드는 모든 경로** | 실데이터 회귀 |
| 새 규칙을 넣으면 | **여기에 케이스를 추가한다** | 자동으로 늘지 않는다 |

새 규칙이 만드는 경로는 반드시 `test_cases` 로 넣는다. 실측 목록에는 아직 없는 입력이 들어갈 수 없어서,
새 규칙의 경로를 구조적으로 못 잡는다(예: `GS25-역삼점` 이 `GS25-` 가 되던 버그, `pg_hints` 출처가 갈라져
`구글플레이-구글페이먼트코리아` 가 다르게 잘리던 버그 — 둘 다 실측 대조는 통과했다).

## 파이썬과 갈라지기 쉬운 지점 — 손대지 말 것

1. **정규식은 `UNICODE_CHARACTER_CLASS` 로 컴파일한다.**
   파이썬 `\s`·`\d`·`\w` 는 기본이 유니코드다. 자바 기본은 ASCII 라 그냥 두면
   `trim_normalize_space` 가 U+3000 같은 공백을 놓치고, `strip_branch` 의 `\d{3,}$` 도 달라진다.

2. **`fullwidth_to_halfwidth` 는 전각 변환이 아니라 NFKC 전체다.**
   `㈜` 가 `(주)` 로 분해되는 것까지 같아야 한다. 직접 전각 매핑표를 짜면 그 순간 갈라진다.
   (그래서 `strip_corp` 의 `㈜` 패턴은 이미 도달 불가능한 죽은 줄이다.)

3. **`upper_ascii` 는 ASCII 만 대문자화한다.** `Character.toUpperCase` 를 전체에 걸면 안 된다.

4. **`_bare`(예외 처리용)와 `strip_special` 의 문자 집합이 다르다.**
   `_bare` 는 `|` 를 지우고 `_` `~` `\` 는 안 지운다. `strip_special` 은 그 반대다.
   하나로 합치면 `protect_exceptions` 판정이 바뀐다.

5. **`strip_branch` 는 첫 성공 패턴 하나만 적용한다.** 반복 적용이 아니다.
   바뀌지만 `min_keep` 미만이면 기록만 하고 다음 패턴으로 넘어간다.

6. **`protect_exceptions` 는 되돌리기다.** `history` 에 각 단계 *실행 직전* 값이 쌓이고,
   예외 토큰이 살아있던 마지막 값으로 돌아간다. 결과가 정규화 덜 된 상태일 수 있다.

7. **트랙 1의 키는 정규화하지 않은 사업자번호다.** `trim()` 만 한다.
   그리고 세 트랙이 서로 다른 파이프라인이 아니다 — 파이프라인은 하나고 트랙은 키만 고른다.

## 알려진 문제

- 절단 판정 바이트를 `euc-kr` 로 재는데, KS X 1001 밖의 한글(`똠`·`힣` 등)을 두 구현이 다르게 센다.
  파이썬은 8바이트 조합형 시퀀스로, 자바는 `?` 1바이트로 센다(`똠양꿍 하우스` 19 vs 12).
  카드사 기준(CP949)으로는 둘 다 2바이트라 둘 다 틀리다. `normalize.yaml` 의 `encoding` 을 `cp949` 로 바꾸면
  양쪽이 같아지지만 규칙 변경이라 따로 다룬다.

## 다음

- 파이프라인 골격(PG블록 → 시드사전 → 키워드룰 → uncertain)은 `T1Result.lookupUnits()` 를
  입력으로 받는다. `norm_key` 전체가 아니라 토큰 단위로 조회해야 `ANTHROPIC|CLA` 가 사전에 닿는다.
- 키워드룰을 어느 문자열에 매칭할지(`match_on`)가 정해지면 그 인자를 받게 확장한다.
  지금 파이썬은 raw 에 매칭 중이고, norm_key 로 옮기면 결과가 갈리는 실측 4건이 있다.
