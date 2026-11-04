# 머리띠를 음영으로 가르고, 화면마다 달랐던 로고를 하나로 모은다

- 브랜치: style/header-and-logo (develop 위)
- 커밋: 1개
- 주요파일: frontend/src/components/Logo.tsx, frontend/src/components/MarketingHeader.tsx, frontend/src/components/AppShell.tsx, frontend/src/components/AuthLayout.tsx, frontend/tailwind.config.js

## 한 일

### 1. 로고를 `Logo` 하나로 모았다

화면마다 따로 그려서 크기와 색이 달랐다.

| 자리 | 막대 | 간격 | 강조 막대 | 글자 |
| :--- | :--- | :--- | :--- | :--- |
| `MarketingHeader` (공개) | 20×5 | 2.5 | `bg-highlight` | `text-h4` |
| `AppShell` (로그인 뒤) | **18×4** | **2** | `bg-highlight` | `text-h4` |
| `AuthLayout` 왼쪽 판 | 20×5 | 2 | **`bg-accent`** | `text-[17px]` |
| `AuthLayout` 좁은 화면 | 20×5 | 2 | **`bg-accent`** | `text-[17px]` |

`text-h4` 가 17px 이라 글자 크기는 같았고, **막대가 달랐다.**

`AuthLayout` 의 `bg-accent` 는 `#16181D` 인데 그 판 바탕이 `bg-ink` `#16181D` 다.
**대비 1.00 — 셋째 막대가 안 보였다.** 강조 막대를 `bg-highlight` 로 통일하면서 같이 풀렸다.

`AppShell` 은 로고 옆에 「판정」을 붙이는데, 같은 링크 안에 있어서 `suffix` 로 받는다.

### 2. 머리띠에 음영을 넣었다

두 머리띠 다 `sticky top-0 bg-canvas/95` 인데 **아래 경계가 아무것도 없었다.**
바탕도 `canvas` 로 같아서 흰 화면에서는 머리띠가 어디서 끝나는지 보이지 않았다.

`border-b border-line` + `shadow-header` 를 같이 뒀다.

## 왜 이렇게 했나

`DESIGN.md:87` 에 **「그림자를 쓰지 않는다. 겹침은 바탕색과 괘선으로만 가른다」** 가
명시돼 있다. 이건 그 규칙을 어기는 것이라 **토큰과 문서를 같이 고쳤다.**

괘선만으로는 모자랐다. 머리띠가 반투명이라 밑으로 지나가는 내용이 괘선 위아래로
비치는데, 선 하나로는 어느 쪽이 위인지 읽히지 않는다. 음영은 아주 옅게 뒀다
(`0 6px 16px -10px rgba(22,24,29,0.22)`) — 머리띠 말고 다른 곳에는 쓰지 않는다고
`DESIGN.md` 에 적었다.

## 확인

- `tsc` 오류 0, `npm test` 190개 통과(1개 파일 건너뜀), `npm run lint` 오류 0
  (경고 10건은 기존 것), `npm run check:tokens` **전부 일치**,
  `VITE_API=http npm run build` 통과(2.18s).
- 브라우저에서 봤다.
  - 랜딩을 스크롤하면 남색 큰 판이 머리띠 밑으로 지나가고 경계가 보인다.
  - 거래 목록(로그인 뒤)에서도 표가 머리띠 밑으로 지나간다.
    `getComputedStyle` 로 그림자가 걸린 것을 확인했다.
  - 로그인 화면 왼쪽 판의 로고에 **노란 막대가 보인다.** 전에는 안 보였다.

## 남은 것 · 아는 문제

- `check:tokens` 는 색과 타이포만 본다. `boxShadow` 는 안 본다 — 그래서 이번 토큰
  추가는 검사에 걸리지 않았고, `DESIGN.md` 는 손으로 고쳤다.
- 스크롤하지 않았을 때도 음영이 보인다. 맨 위에서는 지웠다가 내리면 띄우는 것이 더
  깔끔하지만 스크롤을 따라다니는 상태가 하나 늘어서 여기까지만 했다.
