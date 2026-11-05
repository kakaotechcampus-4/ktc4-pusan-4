# Really 버튼을 원형 FAB 으로 바꾼다

- 브랜치: feat/brand-a11y-really
- 커밋: 44fd2cc (1개)
- 주요파일: Assistant.tsx, index.css

## 한 일

- 로그인 전·후 Really 버튼 둘 다 알약(56×48, bg-ink, 24px 돼지 + 「Really」 글자)에서
  원형 56×56 투명 버튼 + SVG 한 장으로 바꿨다. 글자가 사라진 자리는 aria-label 이 받고,
  글자와 겹치던 sr-only 는 없앴다
- 펴면 같은 크기 bg-ink 원에 접는 화살표를 둔다. 닫힘/열림 모두 56×56 이다
- 버튼에 focus-visible:rounded-full 을 더했다
- index.css 두 줄: body color #30363F → #4E5968, ::selection #ffe600 → #E4EDFB

## 왜 이렇게 했나

really-fab-blue.svg 는 파란 원판에 돼지까지 그려 둔 완성된 버튼 한 장이다.
그걸 알약 안에 24px 로 넣으면 원판 위에 원판이 겹친다. #242 에서 RainDrop3 이
「버튼 자체가 저걸로 바뀌는 걸로 생각했다」고 지적했고, 브랜드 README 도 같은 모양
(투명 버튼 + 원형 SVG, 44·56·72 중 56 이 기본)을 정해 두고 있었다.

글자를 남겼던 근거는 「그림만 두면 무엇을 여는 버튼인지 모른다」였는데, aria-label 과
옆에 뜨는 알림 풍선이 이미 그 역할을 한다. 과하게 봤다.

전역 :focus-visible 이 border-radius: 4px 를 얹는다. 알약일 때도 같은 일이 있었지만
원이 되니 동그라미에 네모 테가 그려져 눈에 띈다. 버튼 쪽 선택자(0-2-0)가 이겨서
focus-visible:rounded-full 한 줄로 되돌아간다.

::selection 은 핑크(highlight)로 가지 않았다. 재 보니 ink 5.72 는 되는데 ink2 2.46,
muted 1.59 라 선택하면 글자가 묻힌다. accent-soft 는 각각 14.04 · 6.03 · 3.91 이다.
이 두 색은 팔레트를 바꿀 때 빠뜨린 것이고, check:tokens 가 tailwind.config·DESIGN.md·
Styleguide 만 보기 때문에 잡히지 않았다.

## 남은 것 · 아는 문제

- check:tokens 가 index.css 는 보지 않는다. 박힌 색이 또 남을 수 있다
- 선택 바탕의 muted 대비 3.91 은 4.5 아래다. muted 글자를 드래그하는 경우라 그대로 뒀다
