# 판정 상세 패널을 읽히게 고치고, 영문 키가 새던 것을 막았다

- 브랜치: fix/judgment-panel-readability
- 주요파일: frontend/src/components/results/JudgmentDetailPanel.tsx, frontend/src/pages/Results.tsx

## 한 일

### 1. attributes 의 영문 키가 화면에 그대로 나왔다

`merchantCategory` 가 라벨 없이 찍히고 있었다. 규칙 카드가 넣는 `attributes`
를 키째로 그리고 있어서다.

```tsx
{attributes.map(([key, value]) => <dt>{key}</dt>)}
```

`ATTRIBUTE_LABEL` 을 두고 모르는 키만 그대로 둔다. 지금 들어오는 키는
`limit_bucket`(한도 묶음)과 `merchantCategory`(가맹점 업종) 둘이다.

**이 키는 내가 넣은 것이다.** #164 에서 분류 확인에 답하면 판정을 만들도록
고치면서 `attributes: { merchantCategory }` 를 달았는데, 그게 화면에 어떻게
보이는지는 보지 않았다.

### 2. 패널 머리를 판정 색으로 칠했다

이 패널에서 가장 먼저 읽어야 하는 것이 판정인데, 12px 배지 하나가 회색
덩어리 안에 묻혀 있었다. 머리 전체를 판정 색으로 칠하고 글자도 키웠다.
`bg`·`line`·`text` 를 세트로 쓴다(DESIGN.md 상태색 규칙).

### 3. 회색 위 회색이라 칸이 갈리지 않았다

패널 바탕이 `surface`(회색)인데 안쪽 칸도 `surface` 였다. 바탕을 흰색으로
바꾸고 기술 정보 줄만 회색으로 남겼다.

### 4. 글자 크기

| | 전 | 후 |
| --- | --- | --- |
| 가맹점명 | 17px | 22px |
| 금액 두 칸 | 15px | 22px |
| 절 제목 | 13px (전부 같아 위계가 없었다) | 14px |
| 기술 정보 | 12px | 13px |

산입액은 금액이 있을 때만 초록으로 둔다.

### 5. 비서 버튼이 패널 끝을 가렸다

오른쪽 아래에 떠 있는 비서 버튼 뒤로 판정 이력이 숨었다. 패널 아래에 여백을
줬다(`lg:pb-20`).

## 확인

- `npx tsc --noEmit` 오류 0 · `npm test` 158개 통과 · `npm run build` 통과 ·
  `npm run lint` 오류 0 · `npm run check:tokens` 전부 일치
- 가능·확인 필요·불가 세 판정을 모두 띄워 머리 색이 갈리는 것을 확인했다
- 기술 정보 줄이 13px 로 올라온 것, 패널 끝이 비서 버튼에 안 가리는 것 확인

## 확인하지 못한 것

`merchantCategory` 라벨은 **코드로만 확인했다.** 목이 새로고침마다 초기화돼서,
분류 확인에 답한 뒤 주소로 `/results` 로 가면 상태가 날아간다. 화면 안에서
이어서 갈 길이 없어 실제로 띄워 보지는 못했다. 바뀐 부분은
`ATTRIBUTE_LABEL[key] ?? key` 한 줄이다.

## 남은 것

- 좁은 화면에서는 패널이 표 아래에 붙는다. 390px 에서 행을 누르면 긴 표를 다
  지나쳐야 패널이 나온다. 아래에서 올라오는 시트가 맞아 보이는데 손대지 않았다
- 모바일 표의 승인일이 `2026. 01. ...` 로 잘린다. 이번 변경 전부터 있던 것이다

---

## 덧 — 다른 브랜치 작업이 딸려 들어갔다

worklog 를 커밋할 때 `git add -A` 로 묶었더니, 작업 트리에 남아 있던 다른
브랜치의 변경(`ExampleCarousel.tsx`, `Landing.tsx`)이 함께 들어가 PR 에
올라갔다. 빼는 커밋을 하나 더 올려 되돌렸고, 캐러셀은
`feat/landing-carousel` 로 따로 올린다.

커밋 안 한 변경은 브랜치를 옮겨도 따라온다. 브랜치를 바꾸기 전에
`git status` 를 보거나, `git add -A` 대신 고친 파일만 집어서 담아야 한다.
