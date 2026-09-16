# 규칙 카드 필드 구조

**이 문서가 단일 원본입니다.** 카드에 여기 없는 최상위 필드를 두면 로더가 조용히 무시합니다.

- 카드 실물: `rules/cards/R-*.yaml`
- 읽는 코드: `backend/.../judgment/rule/RuleCardLoader.java`
- 설계 배경: `CONTEXT.md` §6

필드를 추가·삭제하면 이 문서와 로더를 같이 고칩니다. 한쪽만 고치면 명세와 코드가
어긋난 채로 남습니다 — 실제로 `attributes`가 명세에서만 삭제돼 있던 적이 있습니다.

---

## 13개 필드

| 필드 | 타입 | 필수 | 뜻 |
|---|---|:---:|---|
| `id` | string | ✅ | 유니크. 예 `R-070` |
| `version` | int | ✅ | 카드를 고칠 때 올린다. 판정 이력에 같이 저장된다 |
| `gate` | enum `G0`~`G6` | ✅ | 관문 |
| `priority` | int | ✅ | **401 이상만.** 400 이하는 학습룰 대역이라 로딩 거부 |
| `effective_period` | `{start, end}` | ✅ | `end`는 `null` 가능. 거래일 기준으로 판단 |
| `match` | object | ✅ | 아래 **match** 참고. 조건은 **전부 AND** |
| `verdict` | enum | 조건부 | `가능`·`불가`·`확인필요`. 차단형(G1·G2)은 필수 |
| `out_of_scope` | bool | | 판정하지 않고 넘긴다. `verdict: 확인필요`일 때만 |
| `account` | string | | 계정과목. 예 `소모품비` |
| `citations` | list | 조건부 | 확정 verdict(`가능`·`불가`)면 필수 |
| `attributes` | map | | `match`만으로 확정되는 속성 |
| `question` | object | | 되묻기. 아래 **question** 참고 |
| `review` | `{by, date}` | ✅ | 검토자·검토일 |

---

## match

| 키 | 타입 | 뜻 |
|---|---|---|
| `category` | list | 카테고리. 어휘는 `rules/categories.yaml`이 단일 원본 |
| `exclude_category` | list | 제외할 카테고리 |
| `keyword` | list | `merchant_raw` **부분일치** |
| `amount_min` / `amount_max` | int | 경계 포함 |
| `industry` | list | 업종코드. 예 `["940909"]` |

전부 **리스트만** 받습니다(금액 제외). 스칼라로 쓰면 로더가 거부합니다.

**조건은 전부 AND입니다.** `category`와 `keyword`를 같이 걸면 "그 카테고리로 분류됐지만
상호 원문에 그 단어가 없는 건"이 빠져나갑니다. 둘로 동시에 잡으려면 카드를 나눕니다
(실물 R-004 / R-007이 그 예입니다).

### keyword는 좁게 씁니다

`merchant_raw` 부분일치라 범위가 쉽게 넘칩니다. `건강보험`은 "메리츠화재 건강보험료"까지
잡았고, `원천세`는 정상 납부를 G1 불가로 확정했습니다.

**확정 verdict(`가능`·`불가`)를 내는 keyword 카드는 오탐이 0이 되도록 좁힙니다.
미탐은 확인필요 착지를 전제로 허용합니다.** 비대칭이기 때문입니다 — 오탐은 뒤에서
되돌릴 카드가 없고(priority·관문 순서상 못 내려감), 미탐은 확인필요로 떨어집니다.

---

## verdict와 out_of_scope — 축이 둘입니다

`verdict`는 **얼마나 제한적인가**, `out_of_scope`는 **왜 판정하지 못했는가**입니다.

판정하지 못하는 상태는 넷인데 `verdict`는 전부 `확인필요`입니다. 셋은 엔진이 알고,
**카드가 선언할 건 ② 하나뿐**입니다.

| | 상태 | 예 | 무엇으로 아는가 | 화면에서 할 말 |
|---|---|---|---|---|
| ① | 되묻기 대기 | R-101 답변 전 | `questions`가 비어 있지 않다 | "답해주세요" |
| ② | **범위 밖 핸드오프** | R-070·R-071 | **`out_of_scope: true`** | "판정하지 않고 세무사에게 넘겼습니다" |
| ③ | 후속 관문 대기 | `업무·개인 혼용`, `자택 겸용`, `연간 일시불` | 답은 있는데 effect에 verdict가 없다 | "인정됩니다. 안분 비율만 정하면 됩니다" |
| ④ | 미매칭 안전망 | G2에서 카드 0장 | `unmatched_reason = RULE_NOT_FOUND` | "판정할 규칙이 없습니다" |

②와 ③이 같은 문구로 나가면 방향이 정반대입니다. ③은 **이미 경비로 인정된 건**이라
확인필요로 보이면 사용자가 그냥 포기합니다.

### verdict의 네 번째 값으로 만들지 않습니다

관문 간 병합은 제한 강도 순서로 이긴 쪽을 고릅니다(`JudgmentEngine.moreRestrictive`).

```
가능 < 확인필요 < 불가
```

범위 밖은 불가보다 더 제한적인 것도 덜 제한적인 것도 아닙니다. 축이 다르므로 이 한 줄에
끼우면 순서가 깨집니다.

### unmatched_reason도 재사용하지 않습니다

그 값이 있으면 `JudgmentService`가 `unmatched_log`에 행을 씁니다. 그 로그는 "규칙이 없어
못 잡은 건"을 모아 학습하는 자리인데, 범위 밖 카드는 의도적으로 **매칭에 성공한** 카드입니다.
섞으면 학습 루프가 오염됩니다.

### 로더가 막는 것

- `out_of_scope: true`인데 `verdict`가 `확인필요`가 아니면 거부합니다. 가능·불가로 이미
  답한 카드가 동시에 넘길 수는 없습니다.
- `out_of_scope`가 boolean이 아니면 거부합니다. `ture` 같은 오타가 조용히 `false`로
  떨어지면 핸드오프가 사라지고 확인필요로만 보입니다.

---

## attributes와 되묻기 effect — 경계

속성을 실을 자리가 둘이라 매번 헷갈립니다. 기준은 하나입니다.

> **`match` 조건만으로 값이 정해지면 `attributes`, 답에 따라 갈리면 effect.**

```yaml
# attributes — amount_min 30001 만으로 이미 참이다 (R-060)
attributes:
  증빙필요: true

# effect — 100만원을 넘어도 1년 이내 소모품이면 자산이 아니다 (R-051)
question:
  options:
    - { value: 1년 넘게 사용, 자산: true, 내용연수: 5, 상각방법: 정액법 }
    - { value: 1년 이내 소모, 자산: false }
```

- 갈리는 값을 `attributes`로 내리면 조용히 틀린 속성이 실립니다. 위 예에서 `내용연수: 5`를
  금액만 보고 박으면 소모품에도 감가상각이 붙습니다.
- 확정된 값을 effect에만 두면 사용자가 답해야 비로소 화면에 뜨는 **과잉 질문**이 됩니다.

두 자리는 같은 맵으로 병합됩니다(`JudgmentEngine.mergeAttributes`). 같은 키에 다른 값이
들어오면 예외이므로, **한 카드에서 같은 키를 양쪽에 두지 않습니다.**

### 금액을 바꾸는 답은 판정을 확정시키지 않습니다

미해소 질문이 판정을 확인필요로 끌어내리는지는 그 답이 **결과를 바꾸는지**로 갈립니다
(`JudgmentEngine.changesOutcome`). 바꾸는 건 셋입니다 — 판정, 계정과목, 그리고 **금액**.

| 질문 | effect가 싣는 것 | 강등하나 |
|---|---|:---:|
| R-060 증빙 유무 | `가산세_대상`, `가산세율` | ✗ |
| R-241 자산 여부 | `자산`, `내용연수`, `상각방법` | ✓ |

증빙 답은 가산세만 계산할 뿐 경비 인정 여부도 금액도 건드리지 않습니다. 반면 자산화되면
당해 경비는 상각액뿐이라, 답을 듣기 전에 `가능`으로 확정하면 사용자가 전액 경비로 읽습니다
(**금액 과대계상**). 금액을 바꾸는 속성 키는 `AMOUNT_BEARING_ATTRIBUTES`에 모여 있습니다.

평가셋 E-055가 이 경계를 치명으로 잡습니다.

카드끼리도 마찬가지입니다. `match`가 겹치는 두 속성형 카드가 같은 키에 다른 값을 실으면
로딩 시점에 거부됩니다.

---

## question

| 키 | 필수 | 뜻 |
|---|:---:|---|
| `code` | | 질문 식별자. 예 `CAFE_PURPOSE`. 없으면 `RULE_QUESTION` |
| `text` | ✅ | 사용자에게 보여줄 문장 |
| `fact_type` | ✅ | 답이 저장될 사실 종류. 예 `용도` |
| `group_by` | ✅ | `transaction` \| `merchant_norm`. 묶는 단위 |
| `options` | ✅ | 선택지. 아래 참고 |

`group_by: merchant_norm`은 같은 가맹점 여러 건을 한 번에 묻습니다. 건마다 답이 다를 수
있으면(같은 AWS라도 월 청구와 연간 선결제가 섞임) `transaction`을 씁니다.

### options

```yaml
options:
  - { value: 업무미팅, verdict: 가능, account: 접대비, limit_bucket: 접대비 }
  - { value: 개인,     verdict: 불가 }
  - { value: 업무·개인 혼용 }
```

`value`·`verdict`·`account`를 뺀 **나머지 키가 그대로 판정 속성**이 됩니다. 위에서는
`limit_bucket: 접대비`가 속성입니다.

`verdict`를 두지 않은 선택지는 판정을 확정하지 않습니다(위 `업무·개인 혼용`). 안분·기간배분은
판정이 아니라 금액 산정이라 뒤 관문이 처리합니다. 이게 위 표의 ③입니다.

확정 verdict를 내는 선택지가 있으면 카드에 `citations`가 있어야 합니다.

---

## citations

```yaml
citations:
  - { id: 소득세법-33-1-2, verified: true }
```

`verified: false`면 `id`는 `TODO`여야 합니다(`tools/validate_rules.py`가 봅니다).

**위계에 따라 화면 표시가 달라집니다.** 법률·시행령·시행규칙은 "근거", 그 아래는 "참고"입니다.

```
법률 > 시행령 > 시행규칙 > 기본통칙 > 고시 > 예규 > 심판례 > 판례
```

⚠️ 같은 이름의 고시가 소득세법 근거와 법인세법 근거로 나뉘어 있는 경우가 있습니다.
개인사업자에게 법인세법 근거를 인용하면 조문도 인용문도 실재하는데 결론만 틀린
**근거 오적용**이 됩니다(R-070 주석 참고).

---

## 검증이 도는 곳

| 무엇 | 어디 |
|---|---|
| 스키마·필드·카드 간 충돌 | `RuleCardLoader` — 로딩이 곧 검증이라 위반하면 예외 |
| 실물 카드가 실제로 로딩·판정되는지 | `RuleCardLoaderRealCardsTest` |
| 카테고리 어휘·citation `verified`·마스킹 | `tools/validate_rules.py` |

로더만 보는 것(`priority` 401, `effective_period` 누락, G1 `verdict` 누락, 차단 카드 충돌,
`out_of_scope` 규칙)은 파이썬 검증기가 보지 않습니다. 둘 다 돌려야 합니다.

```
python tools/validate_rules.py
cd backend && ./gradlew test
```
