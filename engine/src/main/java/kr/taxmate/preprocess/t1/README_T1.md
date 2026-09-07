# T1 정규화 해석기 (Java)

`rules/normalize.yaml`(팀 레포, 현빈 관리)을 읽어서 실행한다. 규칙은 이 코드에 없다.

| 파일 | 역할 |
| --- | --- |
| `T1Normalizer.java` | 해석기. YAML 의 `steps` 이름에 해당하는 동작만 제공한다 |
| `T1Result.java` | 결과 record. 파이썬 `Result` 와 필드 1:1 대응 |
| `MiniYaml.java` | 최소 YAML 리더. **검증 환경 전용** |
| `T1Cli.java` | 의존성 없는 러너 |

## 왜 MiniYaml 을 따로 만들었나

검증 환경에서 Maven Central 이 조직 이그레스 정책으로 막혀 있어 SnakeYAML 을 받을 수 없다.
정책을 우회하지 않고, 우리 룰 파일이 쓰는 문법만 읽는 리더를 넣었다.

**백엔드(Spring Boot)에는 SnakeYAML 이 이미 딸려 오므로 그쪽에서는 한 줄만 바꾸면 된다.**

```java
// 검증 환경
Map<String, Object> spec = MiniYaml.load(Path.of("rules/normalize.yaml"));
// 백엔드
Map<String, Object> spec = new Yaml().load(inputStream);
```

`T1Normalizer` 는 `Map<String,Object>` 만 받으므로 해석기 코드는 그대로다.

## 실행

```bash
javac -encoding UTF-8 -d out $(find src/main/java/kr/taxmate/preprocess/t1 -name '*.java')

# normalize.yaml 의 test_cases 회귀
java -Dfile.encoding=UTF-8 -cp out kr.taxmate.preprocess.t1.T1Cli \
     --selftest <레포>/rules/normalize.yaml

# 한 건 확인
java -Dfile.encoding=UTF-8 -cp out kr.taxmate.preprocess.t1.T1Cli \
     --text <레포>/rules/normalize.yaml "스타벅스코리아 강남대로점"

# 파이썬 대조용 배치 (입력: raw<TAB>사업자번호, 사업자번호는 생략 가능)
java -Dfile.encoding=UTF-8 -cp out kr.taxmate.preprocess.t1.T1Cli \
     --batch <레포>/rules/normalize.yaml cases.tsv

# MiniYaml 파싱 결과를 정규 JSON 으로 (yaml.safe_load 와 대조용)
java -Dfile.encoding=UTF-8 -cp out kr.taxmate.preprocess.t1.T1Cli \
     --dump-spec <레포>/rules/normalize.yaml
```

`normalize.yaml` 사본을 이 폴더에 두지 않는다. 사본을 두는 순간 두 파일이 갈라진다.
레포 체크아웃 경로를 인자로 넘긴다.

## 대조 검증 결과 (2026-09-07)

- `normalize.yaml` 의 `test_cases` 19건 전건 통과
- 리포트·test_cases 에 등장하는 실측 상호 43건에 대해 **파이썬과 16개 필드 전부 문자 단위 일치**
  (norm_key / track / string_norm / overseas_norm / tokens / is_truncated / is_overseas /
  enc_bytes / branch_skipped / branch_blocked / protected / pg_hint / cond_split / cond_kept / collapsed)
- `MiniYaml` 파싱 결과가 파이썬 `yaml.safe_load` 와 구조·값 모두 동일 (정규 JSON 대조)

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

## 알려진 문제 (우리 코드 문제가 아님)

- `normalize.yaml` 맨 위는 `encoding_fix: cp949_to_utf8` 인데 절단 판정 바이트는 `euc-kr` 로 잰다.
  CP949 확장 한글(`똠`·`펲` 등)은 EUC-KR 에서 인코딩 불가라 `?` 1바이트로 세어진다.
  파이썬도 같은 동작이라 **대조는 통과하지만 둘 다 같은 값으로 틀릴 수 있다.** 현빈에게 확인 필요.

## 다음

- 파이프라인 골격(PG블록 → 시드사전 → 키워드룰 → uncertain)은 `T1Result.lookupUnits()` 를
  입력으로 받는다. `norm_key` 전체가 아니라 토큰 단위로 조회해야 `ANTHROPIC|CLA` 가 사전에 닿는다.
- 키워드룰을 어느 문자열에 매칭할지(`match_on`)가 정해지면 그 인자를 받게 확장한다.
  지금 파이썬은 raw 에 매칭 중이고, norm_key 로 옮기면 결과가 갈리는 실측 4건이 있다.
