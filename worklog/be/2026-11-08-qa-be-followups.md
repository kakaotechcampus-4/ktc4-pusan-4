# QA 요청 중 BE 몫: 계정과목 화면 이름, 한도 금액, 조문 제목, 파서 확인 필요

- 브랜치: feature/qa-be-followups
- 커밋: a419ee78..7630b981 (4개)
- 주요파일: rules/accounts.yaml, RuleCardLoader.java, StatuteResponse.java, JudgmentEngine.java

## 한 일

QA 에이전트가 BE 에 넘긴 13건을 코드와 대조한 뒤, 정책 결정 없이 할 수 있는 것과 접대비 이름을 처리했다.

- 계정과목(QA C17): `rules/accounts.yaml` 을 계정과목 어휘와 화면 이름의 단일 원본으로 두었다. `RuleCardLoader` 가 카드와 선택지의 `account` 를 이 목록으로 검증하고(밖이면 기동 실패), `RuleSet.accountLabel` 로 이름을 준다. 판정, 요약 `byAccount`, 내보내기에 `accountLabel`, `limits` 에 `bucketLabel` 을 더했다. `접대비` 는 ID 그대로이고 이름만 `기업업무추진비` 다.
- 한도 금액(QA C18): `limits[].limitAmount`. 한도 집계와 같은 최신 문진의 직전연도 수입금액으로 계산한다. 내보내기의 초과 연도 계산은 `LimitYearTotal` 을 거치지 않고 항목에서 바로 구한다.
- 조문 제목과 링크(QA C8, C9): 법령(법률, 시행령, 시행규칙)이면 `StatuteResponse` 가 statuteId 로 조, 항, 호를 붙이고 `제81의6조` 주소를 `제81조의6` 으로 바꾼다. 제목에 이미 조가 있으면 그대로 둔다.
- 파서 확인 필요(QA C33): `toInput` 에 `needsReview` 를 넣고, 엔진이 G0 에서 0원 확인 필요로 멈춘다. 판정 응답 `reviewReason` 에 파서 사유를 G0 확인 필요일 때만 싣는다.

## 왜 이렇게 했나

- 계정과목은 카드 문자열이 ID 이자 화면 문구였다. 엔진의 계정과목 충돌 비교, 요약 묶음, FE `LIMITED_ACCOUNT` 가 이 문자열로 비교해서 이름을 바꾸면 DB 마이그레이션과 FE 동시 배포가 필요했다. ID 는 두고 이름만 붙이면 필드 추가라 FE 와 배포를 맞추지 않아도 된다.
- 이름 표를 BE 코드 대신 rules 에 둔 것은 `categories.yaml` 이 같은 문제(카드 어휘)를 이미 이렇게 풀고 있어서다. 카드에 `displayName` 을 다는 방식은 같은 이름을 7곳에 적어야 하고, 판정에는 account 만 저장돼 응답을 만들 때 카드로 돌아갈 수 없어 고르지 않았다.
- 조문 제목은 api.md 3.13 예시가 이미 조, 항을 붙인 모양이라 코드가 스펙과 어긋나 있었다. 읽을 때 바꾸면 옛 행까지 고쳐지고, 비서도 `/statutes/{id}` 를 읽어 같이 고쳐진다.
- 파서 확인 필요에 `unmatched_reason` 을 쓰지 않은 것은 그 값이 있으면 `unmatched_log` 에 쌓여 규칙 후보를 만들기 때문이다(V5 범위 밖과 같은 이유). 사유는 거래 요약(api.md 3.4, 질문과 분류 응답이 같은 필드를 쓴다)이 아니라 판정 응답에 두었다. 판정 수정 revision 은 `blockedAtGate` 를 이어받아서, 사유는 G0 이면서 확인 필요일 때만 보인다.

## 확인한 것

- 항목마다 테스트를 먼저 쓰고 실패를 확인했다. G0 분기를 빼면 엔진 테스트가 실패하는 것도 따로 봤다.
- `gradlew check` 통과(단위 440, 통합 304 중 건너뜀 7 은 환경변수로 도는 벤치마크, 실패 0). PMD 22건은 develop 과 같다.

## 남은 것 · 아는 문제

- 6번은 저장된 판정을 바꾸지 않는다. 배포 전에 판정한 업로드는 다시 판정해야 G0 이 된다.
- G0 판정을 가능으로 수정하면 계정과목이 비어 `byAccount` 에서 빠진다. G2 미매칭 판정의 수정과 같은 동작이다.
- 「기업업무추진비」 시행일은 law.go.kr 공개 키(OC=test)가 막혀 원문과 대조하지 못해 주석에 날짜를 적지 않았다.
- FE: 표시는 `accountLabel`, `bucketLabel` 로, 비교는 `account` 로 둔다. `limit.ts`, `csv.ts` 의 접대비 문구, `limitAmount` 로 「한도 N원 중 M원」, FE 의 조문 제목 만들기 제거, G0 확인 필요의 `reviewReason` 표시.
- 비서: 표시에 `accountLabel` 을 쓰도록 알려야 한다.
- QA 목록의 나머지(재발급 유예, run 멱등키, 낡은 탭 409, 조문 기준일, 분류 바꾸기 API, 규칙 카드 문구)는 정책을 정한 뒤 한다.

## 02:20 파서 확인 필요(G0)를 되돌리고 리뷰 지적을 고친다

- 커밋: d742552c..17206618 (3개)
- 주요파일: StatuteResponse.java, docs/api.md, docs/schema_mapping.md

### 한 일

- `7630b981`(needs_review 거래를 G0 에서 확인 필요로 멈춤)을 revert 했다. needs_review 는 다시 저장만 하고 판정과 응답에 쓰지 않는다. api.md, schema_mapping.md 에 그렇게 적었다.
- 조문 제목: 호 가지번호가 여러 단(`2의2의3`)이어도 제목을 만든다. parse.py `_HO_NO` 가 허용하는 모양이다.
- api.md 의 accountLabel 설명에서 "비서는 이 값을 보인다"를 뺐다. 비서(`ai/assistant/tools.py`)는 아직 account 를 쓴다.

### 왜 이렇게 했나

- 서브에이전트 적대적 리뷰: G0 판정은 카드를 보지 않아 attributes 가 비어, 사용자가 가능으로 수정하면 거래액 전액이 경비가 되고 접대비 한도, 안분, 상각, 계정과목이 빠진다(`JudgmentOverrideService` 가 원 판정 attributes 로 금액을 다시 계산한다).
- 고치는 방법(카드 판정 뒤 확인 필요로 낮추기, G0 전용 질문)을 따져 보다가, 결제가 남았는지는 경비 여부와 다른 축이라 판정에 넣을 일이 아니라고 정했다. 레포의 선례도 같다: 미분류 거래는 판정 전에 분류 확인으로 정리하고(api.md 3.5, 3.6), 범위 밖은 verdict 가 아닌 별도 컬럼이다(V5).
- 빈도도 낮다. 표시는 취소 짝을 승인번호로 못 찾고 같은 상호·금액 결제가 62일 안에 여럿이거나 62일 밖에만 있을 때만 붙는다(`frontend/src/parser/pipeline.ts`). 356행 측정에서 취소 짝은 1쌍이었다(schema_mapping.md).

### 남은 것 · 아는 문제

- needs_review 는 여전히 어디에도 보이지 않는다. 다룬다면 거래 단계(거래 응답에 싣고 FE 경고, 사용자가 대상 제외)에서 한다.
- 파서는 파일 하나 안에서만 취소 짝을 찾아, 월별로 올리면 다음 달 파일의 취소가 이전 달 결제와 이어지지 않고 표시도 붙지 않는다. 위와 묶어 이슈로 남긴다.
- 항이 없는 조문에도 parse.py `_hang_no` 가 1 을 넣어, 제목에 없는 「제1항」이 붙는다. id 만으로는 구분할 수 없어 parse.py(AI)에서 고쳐야 한다. 지금 카드가 인용하는 조문에는 해당이 없다.
