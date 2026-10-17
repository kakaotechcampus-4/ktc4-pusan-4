# 실서버에서 다르게 보일 화면 다섯 곳을 고쳤다

- 브랜치: feature/card-parser-ts
- 커밋: 2576dfc..8a7b8c1 (6개, develop 병합 1개 포함)
- 주요파일: frontend/src/utils/format.ts, frontend/src/pages/Run.tsx, frontend/src/components/results/JudgmentDetailPanel.tsx, frontend/src/pages/Transactions.tsx

## 한 일

- **develop 병합(2576dfc)** — 이 브랜치는 내 정보 화면(#104)보다 먼저 갈라져 `Account.tsx` 가 옛 모습이었다. 가입일 시각을 고치려면 그 화면이 있어야 해서 develop 을 합쳤다. 충돌은 없었다
- **시각을 KST 로** — `toKst`·`formatDateTime` 을 두고, 문자열을 잘라 쓰던 다섯 곳(판정 시각·이력, 업로드 날짜, 가입일, run 시작 시각)을 바꿨다
  - 소수 초는 밀리초까지만 남기고 읽는다
- **실패 사유는 `errorCode` 로** — `RULE_PROCESSING_FAILED`·`RUN_INTERRUPTED` 는 정해진 문구와 배지로, 모르는 코드는 「처리하지 못했습니다」로 보인다. `message` 는 화면에 내지 않는다
- **빈 실패 목록** — 실패 건수는 있는데 목록이 비면 빈 상자 대신 「어떤 거래에서 실패했는지 받지 못했습니다」를 띄운다. 실패 카드는 목록이 오기 전에도 `failedCount` 만으로 뜬다
- **`explanation` 이 null 이면** — 「설명 문구가 없습니다」를 띄우지 않고 문장을 뺀다. 판정 이유 칸에 보일 것(안내·설명·막힌 게이트·수정 표시)이 하나도 없으면 칸을 통째로 뺀다
- **다시 포함 안내** — 거래를 다시 포함하면 「판정을 새로 실행해야 결과에 반영됩니다」와 확인 화면(`/confirm`)으로 가는 버튼을 띄운다
- **테스트** — `format.test.ts` 에 시각 변환 경우를 고정했다

## 왜 이렇게 했나

- 시각: api.md 1.2 는 KST 인데 판정 쪽 PR(#127~#135)은 `Z` 로, 업로드(#129·#130)는 `+09:00` 으로 준다. 잘라 쓰면 `Z` 시각이 9시간 이르고 자정 근처는 날짜가 하루 이르다. BE 에 +09:00 으로 맞춰 달라고 할 예정이지만, 어느 쪽이 먼저 들어가도 맞게 보이도록 FE 가 offset 을 읽는다
- 소수 초: 서버 시각은 마이크로초까지 온다(Java·Postgres). 밀리초보다 긴 소수를 `Date` 가 읽는지는 브라우저마다 보장되지 않아 잘라서 읽는다
- `message`: api.md 3.6 예시는 고정 문구인데 #127 은 예외 문장을 그대로 담는다(memoryhong 리뷰). 코드는 계약이라 바뀌지 않고, 문구는 서버가 바꿀 수 있어 코드로 고른다
- 빈 목록: #127 은 run 시작이 실패하면 `failedCount` 만 올리고 항목은 PENDING 으로 남아 실패 목록이 빈다(memoryhong 리뷰). `failures` 를 `null`(아직 안 받음)과 `[]`(받았는데 비어 있음)로 나눠야 이 경우를 가린다
- `explanation`: #132 는 늘 null 을 준다. 카드에 reason 필드가 없기 때문이다. 대체 문장을 띄우면 모든 판정에 같은 문장이 붙어, 빠진 게 있는 것처럼 읽힌다. 근거는 바로 아래 조문 칸에 있다
- 다시 포함: 포함 API 는 재판정하지 않아(#135) 다시 판정하기 전까지 판정이 없거나 옛 답으로 낸 판정이 남는다. 제외는 현재 결과에서 바로 빠지므로(#132) 안내하지 않는다
- 브랜치: 처음엔 develop 에서 딴 `fix/real-server-display` 에 올렸다가, #138 과 함께 머지하려고 이 브랜치로 옮겼다

## 확인

- `npm test` 통과(102개, `parity.test.ts` 는 원래대로 건너뜀). 새 `format.test.ts` 는 기계 시간대를 LA 로 바꿔도 통과
- `npm run build`(카테고리·타입 검사 포함) 통과. `npm run lint` 오류 0, 경고 10건은 기존 파일(`Button.tsx`·`SessionContext.tsx`)
- 이 브랜치(develop 병합 뒤)에서 목업으로 다시 띄워, 아래 화면이 그대로 나오고 업로드 화면도 열리는 것을 확인했다
- 처음 확인은 `fix/real-server-display` 에서 같은 커밋으로 했다. 응답을 `Z` 시각으로 바꿔 넣으면 업로드 이력·가입일·판정 시각이 KST 날짜로 바뀌어 나온다(예: `2026-09-12T15:30Z` → 2026. 09. 13)
  - run 시작 시각은 목업이 `Z` 로 주는데 지금 KST 시각과 같게 나온다
  - 실패: `failNextRun(2)` 로 부분 실패를 만들고, 코드를 `RUN_INTERRUPTED`·모르는 코드로, 목록을 빈 배열로 바꿔 각각 문구를 확인했다
  - `explanation` 을 null 로 바꾸면 가능 판정은 판정 이유 칸이 빠지고, 막힌 판정은 게이트만, 직접 수정한 판정은 수정 문장이 남는다
  - 다시 포함하면 안내가 뜨고, 375px 에서 버튼이 아래 줄로 내려가며 가로로 넘치지 않는다
  - 콘솔 오류 없음

## 남은 것 · 아는 문제

- 실서버에서는 아직 못 봤다. #127~#135 가 머지되거나 로컬에서 백엔드 브랜치를 합쳐 띄우면 확인한다
- 다른 에러 코드(`QUESTIONS_FROM_DIFFERENT_BATCHES`·`STATUTE_NOT_FOUND`)는 여전히 `message` 만 띄운다
- 다시 포함 안내는 화면을 벗어나면 사라진다. 다른 화면에서는 다시 판정이 필요한지 알 수 없다
- 원격의 `fix/real-server-display` 브랜치가 남아 있다. 이 브랜치로 옮겼으니 지워도 된다

## 03:41 목·계약을 api.md 에 맞추고, 질문·결과 화면의 한 건씩 부르기를 걷어 냈다

- 브랜치: feature/fe-api-sync (feature/card-parser-ts 위)
- 커밋: eb178f0..8887375 (4개)
- 주요파일: frontend/src/api/mock/index.ts, frontend/src/types/domain.ts, frontend/src/pages/Questions.tsx, frontend/src/components/results/JudgmentDetailPanel.tsx

### 한 일

- **계약·타입** — 판정 `transaction`(거래 요약), 질문 그룹 `status`·`answer`·`bulkAnswerable`·`transactions[]`, 질문 `answer`, 일괄 응답 `excludedCount`, 분류 확인 그룹 줄 `merchantNorm`·`merchantCategory`, include·exclude 는 세 필드, Context `userId`·`createdAt`·자택 비율 null
- **http** — 판정 목록에 `latestOnly` 를 넘긴다. 사용자 수정에 `Idempotency-Key` 를 붙인다
- **목** — api.md 와 #132·#133·#135 브랜치 문서, #134 에 단 의견대로 움직이게 했다
  - 현재 결과·요약에서 미분류도 뺀다. 거래 요약은 읽을 때 지금 거래에서 붙인다
  - 분류 확인이 `batchId` 를 따르고, 배치의 대기 수를 지금 리뷰에서 센다
  - 제외한 거래의 질문은 지우지 않고 조회·집계에서만 거른다. 그룹은 건수 → 금액 → 첫 질문 id 순
  - 소명 대기는 Override 를 뺀 최신 자동 판정으로 본다. 질문 응답은 3.10 순서로 검사한다
  - 사용자 수정: 확인 필요로는 422, 지금 판정이 아니거나 판정 대상이 아니면 409
  - Run 은 넘긴 Context 의 버전을 쓴다. CANCELED 로 거르면 비어 있다(전에는 전부 왔다)
- **화면** — 질문 카드는 그룹 응답만으로 그린다. 결과 표·상세 패널은 판정의 거래 요약을 쓴다. 답한 값은 `group.answer` 에서 읽는다
- **에러 코드** — `QUESTIONS_FROM_DIFFERENT_BATCHES` 는 정해진 문구 + 목록 다시 읽기, `STATUTE_NOT_FOUND` 는 「다시 시도」 없이 알린다. 사용자 수정이 409 면 폼을 닫고 지금 판정을 다시 읽는다
- **테스트** — `api/mock/index.test.ts`(15개), `api/http.test.ts`(2개)를 새로 두었다. api 층 테스트는 처음이다

### 왜 이렇게 했나

- 목은 api.md 를 따른다. 실서버가 들어올 때 `http.ts` 만 바뀌게 하려면 목이 같은 모양과 같은 경우를 내야 한다
- 한 건씩 부르기: 질문 화면은 카드마다 거래·판정을, 결과 화면은 행마다 거래를 따로 불렀다. api.md 가 그룹·판정에 거래 요약을 붙이기로 했으므로(#105) 그 응답만 쓴다
  - 소명 대기 검사도 서버의 `bulkAnswerable` 로 바꿨다. 전에는 카드의 앞 세 건만 보고, 수정한 거래는 소명 대기가 아닌 것으로 셌다. api.md 3.11 은 그룹 전체를, 자동 판정 기준으로 본다
- 거래 요약을 저장하지 않고 읽을 때 붙인 것: api.md 가 「판정 당시가 아니라 응답 시점의 거래 값」이라 한다. 재판정·수정이 이전 revision 을 복사하므로 저장하면 분류를 바꾼 뒤 옛 카테고리가 남는다
- 409 기준을 「최신 revision」이 아니라 「지금 판정」으로 했다. 활성 Override 뒤에 자동 판정이 쌓여도 현재는 Override 라서(3.7), 최신 기준이면 한 번 수정한 판정을 다시 바꿀 수 없다. #62 2번 문구가 「최신」이라 BE 에도 같은 뜻인지 확인한다
- 키를 내용이 바뀔 때마다 새로 만든 것: 같은 키에 다른 내용이면 409 `IDEMPOTENCY_KEY_REUSED`(1.6)라, 「판정이 바뀌었다」는 409 와 구분할 수 없다
- `latestOnly=false` 를 `transactionId` 없이 쓰는 경우(#132 문서)는 목에 넣지 않았다. 쓰는 화면이 없다

### 확인

- `npm run build`·`npm test`(119개 통과, `parity.test.ts` 는 원래대로 건너뜀)·`npm run lint`(오류 0, 경고 10건은 기존 `Button.tsx`·`SessionContext.tsx`), `VITE_API=http` 빌드 통과
- 커밋마다 따로 타입 검사와 api 테스트를 돌렸다
- 목업으로 띄워 확인했다(콘솔 오류 없음)
  - /questions 를 열 때 api 호출이 `questions.grouped` 두 번뿐이다. /results 는 `transactions.get` 이 없다
  - 답한 값이 다른 화면에 갔다 와도 「…로 답함」으로 남는다. 「용도」에 소명 대기가 섞이면 일괄 답변을 막고, 풀면 「3개 전부 「개인」으로 답하기」 → 「나머지 질문 1건은 그대로 남았습니다」
  - 패널 뒤에서 판정을 바꾼 뒤 수정하면 409 문구가 뜨고 폼이 닫히며 지금 판정(rev.3, 사용자 수정)으로 바뀐다. 그 거래에 다시 답해 자동 판정(rev.4)이 쌓인 뒤에도 수정한 판정을 다시 바꿀 수 있다(rev.5)
  - 조문 404 는 「이 조문 버전을 찾을 수 없습니다」만 뜬다. 섞인 업로드 응답을 흉내 내면 정해진 문구와 함께 목록을 다시 읽는다
  - 분류 확인에 답하면 업로드 이력의 「확인 N건」이 준다(6 → 5). 거래 제외 → 「다시 포함」으로 바뀐다
  - Chrome 창이 559px 아래로 줄지 않아 375px 는 못 봤다. 559px 에서 가로로 넘치지 않는다

### 남은 것 · 아는 문제

- 목에서 새로 올린 배치는 거래를 저장하지 않아, 올린 뒤 「다음: 분류 확인」이 아니라 「다음: 사업자 문진」이 뜬다. 전에는 다른(시드) 배치의 분류 확인을 보여 줬다. 처음부터 끝까지 보려면 시드 배치(세션 시작값)로 본다
- 질문 응답의 가맹점 단위 재판정 확장과 CANCELED 는 목에 없다. 2.12 에 없는 카테고리를 쓰는 픽스처도 그대로다
- 실서버는 아직 못 봤다
