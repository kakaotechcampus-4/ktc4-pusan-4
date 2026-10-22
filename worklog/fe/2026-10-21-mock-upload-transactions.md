# 목이 올린 거래를 저장하고, 분류를 확인하면 판정을 만들게 했다

- 브랜치: fix/mock-upload-transactions
- 주요파일: frontend/src/api/mock/index.ts, frontend/src/api/mock/index.test.ts

## 왜 지금 고치나

배포 번들이 목으로 돈다. `deploy/web.Dockerfile` 이 `VITE_API` 없이
`npm run build` 하고, `src/api/index.ts` 는 `VITE_API === 'http'` 일 때만
실서버를 쓴다. 그래서 아래 두 가지가 「목에서만 나는 문제」가 아니라
**배포된 화면에서 보이는 문제**였다.

## 한 일

### 1. `uploads.create` 가 거래를 저장한다

배치만 만들고 `store.transactions` 에는 아무것도 넣지 않고 있었다. 목 전체에서
`store.transactions` 에 쓰는 곳은 배치를 지울 때 거르는 `filter` 하나뿐이었다.

그래서 업로드하면 이렇게 됐다.

```
/uploads · /confirm   11건
/transactions          0건
판정                   0건인데 "판정을 마쳤습니다"
```

파서가 준 `ParsedTransaction` 을 `Transaction` 으로 바꿔 저장한다.
`effectiveStatus` 는 기존 `effectiveOf` 로 계산한다.

### 2. 분류하지 못한 거래를 분류 확인으로 남긴다

가맹점 이름 → 업종을 키워드로 추정한다(`guessMerchant`). 서버는 PG·개인 사전·
전역 사전·키워드룰을 차례로 보지만(#124) 목은 키워드 몇 개만 본다. 못 맞히면
`미분류` + `NEEDS_REVIEW` 로 두고 분류 확인을 만든다. 취소상계·대상제외는
판정 대상이 아니라 만들지 않는다.

`classificationPendingCount` 도 이제 실제로 만든 수다(전에는 0 고정이었다).

### 3. 분류 확인에 답하면 판정이 생긴다

`judgedCount` 를 `rows.length` 로 세기만 하고 판정은 만들지 않았다. 게다가
`judgeRun` 은 `if (!prev) return` 으로 판정이 없는 거래를 건너뛰어서, 이후
새 Run 을 돌려도 영영 판정이 생기지 않았다.

결과: Run 은 「29건 완료」인데 가능·확인필요·불가 합이 23건이었다.

완료된 Run 이 있으면 해결된 거래마다 `origin.type = 'CLASSIFICATION_REVIEW'`
판정을 만든다(api.md 3.5). 목은 규칙 엔진을 돌릴 수 없어 업종으로 가르고,
표에 없는 업종은 단정하지 않고 `NEEDS_REVIEW` 로 둔다.

## 확인

- `npx tsc --noEmit` 오류 0 · `npm run build` 통과 · `npm run lint` 오류 0
- `npm test` **158개 통과** (153 → 테스트 5개 추가)
- **새 테스트가 고치기 전에 실제로 깨지는지 확인했다.** `index.ts` 만 되돌리고
  돌리니 4개가 실패했다
  - 업로드 건수 ≠ 거래 수 / 분류 확인이 안 생김 / 판정이 안 쌓임 / 합계 그대로
  - 「지운 배치의 거래는 함께 사라진다」는 옛 코드에서도 통과한다. 거래가
    아예 없어서 공허하게 지나간다 — 이번 수정 뒤에야 뜻이 생긴다
- 브라우저에서 KB 샘플 파일로 업로드까지 걸어 봤다
  - 「11건을 올렸습니다 · 가맹점 업종을 확인할 거래가 6건 있습니다」
  - `/transactions` 에 11건이 실제로 보인다. 교보문고가 「도서」로 분류됐다
  - 처음에는 「넷플릭스」가 분류 확인으로 샜다. 키워드가 영문만 봐서였다.
    한글 가맹점(넷플릭스·쿠팡·지하철·하이마트)을 넣고 테스트로 고정했다

## 하지 않은 것

- **중복 파일·Idempotency-Key 재사용은 그대로 흉내 내지 않는다.** 같은 키로 두 번
  보내면 배치가 두 개 생기고, `skippedDuplicateCount` 는 늘 0 이다. 계약은
  409 `DUPLICATE_FILE` 이다. `Transaction` 에 `naturalKey` 가 없어 옆 자료구조가
  필요하고, 이번에 고치려던 「화면끼리 숫자가 안 맞는 것」과는 다른 문제라 뺐다
- 빈 거래 배열(422 `EMPTY_TRANSACTIONS`)도 검사하지 않는다. 화면이 보낼 거래가
  0건이면 버튼을 막아 두어 도달하지 않는다
- 업종 추정은 키워드 10여 개뿐이다. 샘플 파일에 나오는 가맹점을 맞히는 정도다
