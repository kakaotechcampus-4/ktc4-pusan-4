# 색을 차갑게 옮기고 첫 화면 큰 판을 남색으로 바꿨다

- 브랜치: feat/finance-tone
- 이어지는 문서: `2026-10-21-kakao-ir-rebase.md`
- 주요파일: frontend/tailwind.config.js, frontend/src/pages/Landing.tsx,
  frontend/src/components/OrbitStage.tsx, frontend/DESIGN.md

## 왜 바꿨나

「금융앱 느낌을 내되 토스 색을 그대로 쓰지는 말 것」이 요구였다.

toss.im 을 재 보니 파랑이 아니라 **중성색이 푸른 쪽으로 기울어 있는 것**이
느낌의 정체였다. 글자색이 `#000000`·`#333840`, 어두운 면이 `#1C1F25` 다.
파랑(`#3182F6`)은 가져오지 않고 기울기만 가져왔다.

## 1. 중성색을 차갑게

| 토큰 | 전 | 후 |
| :--- | :--- | :--- |
| `ink` | #0A0A0A | #16181D |
| `ink2` | #2B2B2B | #30363F |
| `muted` | #5D6670 | #67707E |
| `surface` | #F5F6F8 | #F3F5F7 |
| `line` | #ECEEF1 | #E8ECF0 |
| `accent-line` | #DDE1E6 | #DCE1E8 |
| `link` | #1A6DFF | #1B64DA |
| `warn` | #955A00 | #8A5A10 |
| `deny` | #C92A2A | #C5283D |

상태색 배경·테두리도 같이 옮겼다. **대비를 상대휘도로 다시 계산했다** —
흰 바탕에서 ink 17.76 / ink2 12.17 / muted 5.01, 패널 위 muted 4.58,
상태색 글자는 전부 4.95 이상이라 AA(4.5)를 넘는다.

`index.css` 의 생 hex 두 곳(body 글자색, focus 외곽선)도 같은 값으로 맞췄다.
`tailwind.config.js`·`DESIGN.md`·`Styleguide.tsx` 세 곳을 함께 고쳐
`check:tokens` 가 통과한다.

## 2. 첫 화면 큰 판을 남색으로

`surface2` 를 `#FFE600`(노랑) → `#122E55`(남색).

**처음에 토큰만 바꿨다가 글자가 묻혔다.** 제목이 `text-ink` 라 남색 위에서
안 보였다. 바탕을 어둡게 하려면 그 위에 올라간 것을 전부 같이 봐야 한다.

- 큰 제목 `text-ink` → `text-white` (대비 13.57)
- 위 작은 줄 `text-ink2` → `text-highlight` 노랑 (대비 10.71)
- 궤도 가운데 문구 `text-ink` → `text-white`
- 궤도 테 `border-ink/[0.07]` → `border-white/20` — 먹색 7%는 남색에서 안 보인다

노랑은 버리지 않고 **강조로만** 남겼다(히어로 윗줄, 로고 세 번째 막대, 말풍선).

## 3. 궤도 그림도 반전 대응

`OrbitStage` 의 그림은 **흰 바탕을 노란 판에서 떼어내려고** 검정 외곽선
(`stroke="#0A0A0A" strokeWidth="2.5"`)을 두고 있었다. 남색에서는 바탕이 그
역할을 하므로 외곽선을 전부 뺐다. 두면 획의 절반이 남색에 걸쳐 가장자리가
지저분해진다.

겸사겸사 남아 있던 옛 값도 지금 토큰으로 맞췄다.

- `#0A0A0A`(옛 ink) → `#16181D`
- `#C9CDD2`(따뜻한 회색) → `#DCE1E8`
- `#FF6A00` 주황 → `#FFE600` 노랑 강조
- `#FF4B4B` 빨강 → `#FF5A5A`(deny-bar)
- 노란 말풍선 안 점은 흰색 → 남색

## 4. 옆 숫자 카드도 남색으로

`bg-ink2`(#30363F) 중성 다크가 남색 판 바로 옆에 있으니 **서로 다른 검정 둘**로
따로 놀았다. 모바일에서 위아래로 쌓이면 특히 티가 난다. 같은 `surface2` 로
옮겼다. `surface2` 가 두 곳에서 쓰이게 돼 DESIGN.md 설명도 고쳤다.

## 확인

- `npx tsc --noEmit` 오류 0 · `npm run check:tokens` 전부 일치
- `npm test` **158개 통과** · `npm run build` 통과
- `npm run lint` 오류 0 (경고 10건은 기존 파일)
- 1440 / 375 두 폭에서 직접 띄워 봤다. 모바일은 궤도가 숨고 테만 남는데
  테 색을 바꿔서 이제 보인다

## 남은 것

- **헤더 로고의 노란 막대는 흰 바탕에서 대비 1.1:1** 이다. 이번 변경과 무관한
  기존 문제고 `aria-hidden` 장식이라 두었다. 로고 교체 때 같이 볼 것
- 어두운 판 위 글자를 쓰는 곳이 늘었는데 아직 토큰이 아니라 `text-white`·
  `text-white/60` 생값이다. 어두운 면이 더 늘면 토큰으로 뽑을 것
