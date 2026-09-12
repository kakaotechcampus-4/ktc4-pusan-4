# 경비판정 디자인 시스템 (초안)

랜딩 페이지 디자인을 기준으로 뽑은 첫 번째 버전이다. 앱 화면은 기능·API 명세서가 나온 뒤
이 부품으로 만들며, 부족한 부품은 그때 추가한다.

살아 있는 예시: 개발 서버에서 `/styleguide`.

## 구조

| 층 | 어디에 | 무엇 |
|---|---|---|
| 토큰 | `tailwind.config.js` | 색·타이포·폭·그림자·이징. 화면에서는 이름으로만 쓴다 |
| 부품 | `src/components/ui/` | Button, Card, Badge, SectionHeading, Container, Input/Select/Field |
| 도메인 부품 | `src/components/` | VerdictBadge, StatuteCitation, AgentPreview — ui 부품 위에 도메인 의미를 얹은 것 |
| 규칙 | 이 문서 | 코드로 강제 못 하는 것 |

## 토큰

### 색

| 이름 | 값 | 용도 |
|---|---|---|
| `canvas` | #F6F7F9 | 페이지 바탕, 구분 섹션 배경 |
| `surface` | #FFFFFF | 카드, 헤더, 입력 |
| `line` / `line2` | #E4E7EC / #F0F2F5 | 테두리 / 약한 구분선·칩 배경 |
| `ink` / `ink2` / `muted` | #101418 / #3A424D / #6B7480 | 제목·강조 / 본문 / 보조 |
| `accent` | #1F4FD8 | CTA, 링크, 아이브로우 |
| `accent-hover` / `accent-soft` / `accent-line` | #183FAE / #EEF2FE / #C7D5F8 | primary hover / soft 버튼 배경 / soft hover·연한 테두리 |
| `ok` / `ok-bg` / `ok-line` | #0B7A4B / #E9F6EF / #B7E0CB | 가능 |
| `warn` / `warn-bg` / `warn-line` | #8A5209 / #FDF4E3 / #EBD3A3 | 확인 필요 |
| `deny` / `deny-bg` / `deny-line` | #B02318 / #FCEDEB / #F0C4BE | 불가 |

**상태색 규칙**
- `ok·warn·deny`는 `bg + line + text` 세 개를 항상 세트로 쓴다. 글자만 빨갛게 하지 않는다.
- 색만으로 상태를 말하지 않는다. 판정 배지에는 기호(✓ ? ✕)가 반드시 붙는다 → `VerdictBadge` 사용.
- 상태색은 판정 결과에만 쓴다. "성공했습니다" 토스트에 `ok`를 쓰지 않는다.

### 타이포

임의 크기(`text-[15px]`)는 쓰지 않는다. 아래 13개가 전부다.

| 토큰 | 크기/행간 | 용도 |
|---|---|---|
| `h1` → `h1-lg` | 38/46 → 52/64 | 랜딩 히어로 제목 |
| `h2` → `h2-lg` | 28/38 → 36/48 | 섹션 제목, 앱 페이지 제목 |
| `h3` → `h3-lg` | 22/30 → 26/34 | 소섹션·큰 카드 제목 |
| `h4` | 17/24 | 카드 제목, 로고 |
| `stat` | 34/34 | 숫자 강조 |
| `lead` | 16/32 | 히어로 리드 문단 |
| `body-lg` | 15/28 | 설명 문단, 폼 라벨 |
| `prose` | 14/28 | 마케팅 본문 (넉넉한 행간) |
| `body` | 14/24 | 앱 UI 본문, 입력, 버튼 |
| `small` | 13/20 | 캡션, 표 셀, 보조 설명 |
| `caption` | 12/18 | 메타 정보, 칩 |

- 반응형은 `h1·h2·h3`만: `text-h2 sm:text-h2-lg`. 나머지는 고정.
- 제목은 `font-bold tracking-tight`. 본문에 tracking을 건드리지 않는다.
- 숫자는 `tabular-nums`.
- Tailwind 기본 `text-sm`(14/20)·`text-xs`(12/16)는 Badge 안에서만 쓴다. 새 코드에서는 위 토큰을 쓴다.

### 간격·형태

- 페이지 폭 `max-w-page`(1180px) + `px-6` → `Container`가 대신 한다.
- 섹션 세로 여백: 랜딩 `py-24`, 구분 띠(숫자·흐름) `py-14~16`.
- 라운드: 카드·패널 `rounded-2xl`, 버튼 md/lg·입력 `rounded-xl`, 버튼 sm `rounded-lg`, 칩 `rounded-md`, 배지 `rounded-full`.
- 그림자는 `shadow-card`(거의 없음)와 `shadow-panel`(떠 있는 패널) 둘뿐. 카드는 테두리로 구분하고 그림자를 쓰지 않는다.
- 전환: `transition-colors duration-150 ease-snap`. 등장 애니메이션은 `animate-rise` 하나.

## 부품

### Button
```tsx
<Button to="/login" size="lg">무료로 판정해보기</Button>          // 라우터 링크
<Button href="#system" variant="ghost" size="inline">보기 →</Button>  // 앵커
<Button type="submit" variant="secondary" size="md">저장</Button>   // 버튼
```
- `variant`: `primary`(파랑) · `secondary`(테두리) · `soft`(연파랑) · `ghost`(텍스트)
- `size`: `sm` 헤더·표 안 · `md` 폼 · `lg` 랜딩 CTA · `inline` 문장 속 링크(ghost 전용)
- 한 뷰포트 안에 `primary`는 하나. 나머지 행동은 `secondary`/`soft`. 예외: 랜딩 끝의 CTA가 히어로 CTA와 같은 목적지를 반복하는 것은 허용 (스크롤로 떨어져 있고 행동이 하나이므로).
- 되돌릴 수 없는 동작(제출·삭제·외부 발송) 버튼은 이 서비스에 없다. 그런 버튼이 필요해지면 이 문서를 먼저 고친다.

### Card
`tone` surface(기본)·canvas·ink, `padding` sm(24)·md(28)·lg(32/40), `as` div·article·section·li.
목록 항목이면 `as="li"`, 독립된 내용이면 `as="article"`.

### Badge / VerdictBadge
- 판정 3분류는 항상 `VerdictBadge verdict=...`. 기호·색·라벨이 `utils/verdict.ts`의 `VERDICT_META` 한 곳에서 온다.
- 그 외 상태 표시는 `Badge tone=...`. 다크 배경 위에서는 `tone="inverse"`.

### SectionHeading
`eyebrow → title → description` 순서 고정. `size` lg(h1)·md(h2, 기본)·sm(h3). 다크 배경은 `inverse`.

### Container
모든 섹션 내용은 이 안에 둔다. 배경색이 있는 띠 섹션은 `<section class="bg-canvas"><Container>…` 구조.

### Field · Input · Select
- 라벨 `body-lg semibold`, 힌트 `small muted`, 오류 `small deny` + `role="alert"`.
- 입력은 기본 `w-full`. 폭을 줄이려면 `className`이 아니라 감싸는 div에 폭을 준다 (클래스 충돌 회피).

## 말투·표현 규칙 (코드가 못 막는 것)

- **AI가 판정한다고 쓰지 않는다.** 판정은 규칙 엔진이 한다. AI는 분류까지. 카피에 "AI가 판단", "AI 추천" 금지.
- **결과에는 근거가 붙는다.** 판정을 보여주는 모든 화면에 `StatuteCitation`이 있어야 한다. 근거 없는 판정 UI는 만들지 않는다.
- **단정하지 않는다.** "가능합니다" 대신 "가능 · 근거 2건". 확인 필요는 실패가 아니라 "질문 하나 더"로 표현한다.
- **하지 않는 일을 먼저 말한다.** 전자신고·세액 확정·금전 이동을 암시하는 UI 요소를 만들지 않는다.
- 문장은 짧게, 존댓말 "-합니다". 느낌표 안 쓴다.

## 새 부품이 필요할 때

1. 기존 부품의 `variant`/`tone`으로 되는지 먼저 본다.
2. 안 되면 `ui/`에 추가하고 `/styleguide`에 예시를 넣는다. 예시 없는 부품은 없는 부품이다.
3. 이 문서의 표를 갱신한다.

## 아직 없는 것 (앱 화면 명세 뒤 추가 예정)

Table, Tabs, Toast/알림, Modal, 진행 표시(Stepper), 빈 상태(Empty), 파일 드롭존.
지금 앱 페이지(`Upload`, `Interview`, `Results` 등)는 아직 옛 클래스 그대로이며, 명세 확정 후 치오님과 나눠 교체한다.
