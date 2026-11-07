# PreeT 디자인 시스템 (초안)

랜딩 페이지 디자인을 기준으로 뽑은 첫 번째 버전이다. 앱 화면은 기능·API 명세서가 나온 뒤
이 부품으로 만들며, 부족한 부품은 그때 추가한다.

살아 있는 예시: 개발 서버에서 `/styleguide`.

## 구조

| 층 | 어디에 | 무엇 |
|---|---|---|
| 토큰 | `tailwind.config.js` | 색·타이포·폭·그림자·이징. 화면에서는 이름으로만 쓴다 |
| 부품 | `src/components/ui/` | Button, Card, Badge, SectionHeading, Container, Input/Select/Field, ChoiceGroup, Empty, Table/Pagination, FilterBar, Modal |
| 도메인 부품 | `src/components/` | VerdictBadge, StatuteCitation, OrbitStage — ui 부품 위에 도메인 의미를 얹은 것 |
| 타입 | `src/types/domain.ts` | API 명세와 1:1. 화면 편의 필드를 여기 추가하지 않는다 |
| 데이터 | `src/api/` | 화면은 `api.*`만 호출. 서버 상태를 화면·Context에 두지 않는다 |
| 규칙 | 이 문서 | 코드로 강제 못 하는 것 |

## 토큰

### 색

| 이름 | 값 | 용도 |
|---|---|---|
| `canvas` | #FFFFFF | 페이지 바탕, 카드·패널 바탕 |
| `surface` | #F2F4F6 | hover, 고른 상태. 카드·패널·구역을 칠하지 않는다 |
| `surface2` | #2C6AE8 | 첫 화면 큰 판과 그 옆 숫자 카드. 위에 올리는 글자·그림은 흰색 |
| `sheet` | #FFFFFF | 표, 떠 있는 시트 (canvas 와 같은 흰색) |
| `line` / `line2` | #E5E8EB / #EDEFF2 | 카드 테두리·행 괘선 / 약한 구분선. `line2` 는 `surface` 위에서도 보여야 해서 `surface` 보다 진하다 |
| `edge` | #838B96 | 입력칸·select·고르지 않은 선택지의 테두리. 흰 바탕 3.44, `surface` 3.12 (컨트롤 경계 3:1) |
| `rule` | #191F28 | 표 머리 위 굵은 괘선 |
| `ink` / `ink2` / `muted` | #191F28 / #4E5968 / #5F6B78 | 제목·내용 / 읽어야 하는 보조 글 / 날짜·건수 같은 작은 메타 정보 |
| `accent` | #2C6AE8 | 주 버튼과 지금 고른 자리(현재 화면, 고른 필터, 진행 중 단계)에만 |
| `accent-hover` / `accent-soft` / `accent-line` | #1C5FD4 / #E4EDFB | primary hover, `accent-soft` 위의 글자 / 고른 선택지·고른 행·진행 중 단계의 바탕 / 테두리 버튼 (#DCE3EB) |
| `link` | #2C6AE8 | 문장 속 링크 |
| `highlight` | #FF5C9A | 한 화면에 한 번만 쓰는 강조 |
| `ok` / `ok-bg` / `ok-line` / `ok-bar` | #00703D / #E8F6F0 / #B2E3CE / #12B76A | 가능 |
| `warn` / `warn-bg` / `warn-line` / `warn-bar` | #8A5A10 / #FDF3E3 / #EFD7A4 / #F7A51B | 확인 필요 |
| `deny` / `deny-bg` / `deny-line` / `deny-bar` | #C5283D / #FDEDEF / #F7CDD4 / #FF5A5A | 불가 |

**회색 규칙**
- 내용은 흰 바탕에 두고 간격으로 가른다. `bg-surface` 로 카드·패널·구역을 칠하지 않는다. 경계가 꼭 필요한 덩어리만 흰 상자 + `border border-line` + `rounded-2xl`(= `Card`).
- `surface` 는 hover 와 고른 상태의 바탕에만 쓴다. 고른 것이 hover 와 같아 보이면 안 되므로 고른 행·고른 선택지는 `accent-soft` 다.
- 글자는 `ink`(내용), `ink2`(읽어야 하는 보조 글), `muted`(날짜·건수 같은 작은 메타 정보) 셋이다. 메타 정보도 대부분은 빼는 것이 낫다(아래 문구 규칙).
- 입력칸·select·고르지 않은 선택지의 테두리는 `edge` 다. `line` 은 흰 바탕 1.23 이라 칸이 어디서 끝나는지 안 보인다.

**판정색 규칙**
- `ok·warn·deny` 는 **판정에만** 쓴다. 가능·확인 필요·불가 배지(`VerdictBadge`)와 판정 건수가 전부다.
- 성공 체크, 진행, 완료, 안내, 업로드 상태, 처리 상태에는 쓰지 않는다. 그런 것은 `ink` 나 `accent` 로 말한다. 「다 처리했습니다」도 초록이 아니다(`Empty tone="ok"` 는 accent 아이콘이다).
- 오류는 실패한 것 바로 옆의 `text-deny` 한 줄 + 잘못 넣은 칸의 `border-deny`(`Input` 에 `aria-invalid` 를 건다)로 알린다. `bg-deny-bg`·`bg-warn-bg`·`bg-ok-bg` 로 칠한 안내 상자·띠는 쓰지 않는다.
  - 예외는 하나다. 화면 전체가 실패했을 때의 `Empty tone="error"`.
  - 되돌릴 수 없는 동작의 `Modal` 제목과 `danger` 버튼은 `deny` 다.
- 색만으로 상태를 말하지 않는다. 판정 배지에는 기호(✓ ? ✕)가 반드시 붙는다 → `VerdictBadge` 사용.
- **글자색과 채움색을 섞지 않는다.** `ok·warn·deny` 는 글자용이라 대비(4.5:1) 때문에 어둡다. 막대·점처럼 글자가 안 올라가는 채움에는 `ok-bar·warn-bar·deny-bar` 를 쓴다.
- verdict·classificationStatus: 계약이 `NEEDS_REVIEW` 로 부르는 "사람 확인이 필요하다"는 판정의 확인 필요다. 분류 확인(/preview)에서 업종이 없는 가맹점은 **분류 필요**라 부르고 판정색을 쓰지 않는다.

**accent 규칙**
- 파랑은 주 버튼과 지금 고른 자리(현재 화면, 고른 필터·선택지·행, 진행 중 단계)에만 쓴다. 장식이나 강조로 쓰지 않는다.
- `accent-soft` 위의 글자는 `accent-hover` 다. `accent` 는 그 위에서 4.11 이라 작은 글자에 모자란다.

**대비** — 색을 바꾸면 다시 잰다. 글자는 4.5:1, 컨트롤 테두리는 3:1 이상이다. 지금 값(흰 바탕 / `surface` / `accent-soft`):

| 색 | 흰 바탕 | `surface` | `accent-soft` |
|---|---|---|---|
| `ink2` | 7.11 | 6.45 | 6.03 |
| `muted` | 5.44 | 4.93 | 4.61 |
| `accent` | 4.85 | 4.39 | 4.11 |
| `accent-hover` | 5.77 | 5.24 | 4.90 |
| `edge` (테두리) | 3.44 | 3.12 | 2.92 |

판정 글자는 자기 `-bg` 위에서 ok 5.58, warn 5.38, deny 4.95 다. `accent` 글자는 흰 바탕에서만 쓴다.

### 타이포

임의 크기(`text-[15px]`)는 쓰지 않는다. 아래 19개가 전부다.

| 토큰 | 크기/행간 | 용도 |
|---|---|---|
| `ir-display` | 48/60 | 첫 화면 큰 판 제목 |
| `ir-section` | 48/72 | 랜딩 섹션 제목 |
| `ir-panel` | 30/45 | 랜딩 패널·카드 제목, 큰 숫자 |
| `ir-num` | 26/39 | 띠 카드 숫자 |
| `ir-lead` | 22/33 | 큰 알약 글자, 리드 |
| `h1` → `h1-lg` | 38/48 → 52/66 | (앱 화면 큰 제목) |
| `h2` → `h2-lg` | 28/38 → 36/48 | 앱 페이지 제목, 좁은 화면의 섹션 제목 |
| `h3` → `h3-lg` | 22/30 → 26/36 | 소섹션·큰 카드 제목 |
| `h4` | 17/26 | 카드 제목, 로고 |
| `stat` | 34/36 | 숫자 강조 |
| `lead` | 17/30 | 리드 문단 |
| `body-lg` | 15/28 | 설명 문단, 폼 라벨 |
| `prose` | 14/28 | 마케팅 본문 (넉넉한 행간) |
| `body` | 14/24 | 앱 UI 본문, 입력, 버튼 |
| `small` | 13/20 | 캡션, 표 셀, 보조 설명 |
| `caption` | 12/18 | 메타 정보, 칩 |

- **굵기는 400 과 700 둘뿐이다.** `font-medium`·`font-semibold` 를 쓰지 않는다.
- **큰 제목은 가늘게 쓴다.** `ir-display`·`ir-section` 은 `font-normal` + `tracking-ir`(-1px). 굵게 하면 흔한 화면이 된다. 굵은 700 은 `ir-panel` 이하의 작은 제목과 숫자에만 쓴다.
- 자간 토큰은 셋: `tracking-ir`(-1px, 48px 제목) · `tracking-ir-sm`(-0.8px, 30px 안팎) · `tracking-ir-xs`(-0.6px, 22px). 본문에는 자간을 건드리지 않는다.
- `ir-*` 는 넓은 화면 전용이다. 좁은 화면에서는 `h2`·`h3` 로 떨어뜨린다: `text-h2 lg:text-ir-section`.
- **한글 제목에는 `[word-break:keep-all]` 을 붙인다.** 안 붙이면 좁은 화면에서 음절 단위로 꺾인다(「이 카드값이 경 / 비인지,」).
- 숫자는 `tabular-nums`.
- Tailwind 기본 `text-sm`·`text-xs` 는 Badge 안에서만 쓴다.

### 간격·형태

- 페이지 폭 `max-w-page`(1440px). 좌우 여백은 `px-6 lg:px-gutter`(62px) — 레퍼런스에서 잰 값이다.
- 섹션 세로 여백: 랜딩 `pt-28`, 구분 띠(숫자) `py-16`.
- 라운드: 패널·카드 `rounded-2xl`(24px), 큰 판 `rounded-[20px]`, 중간 `rounded-xl`(16px)·`rounded-lg`(12px), **버튼·알약은 `rounded-full`**.
- 초점 테(`:focus-visible`, index.css)는 모서리를 건드리지 않는다. 요소의 `rounded-*` 를 따라 그려지므로 버튼마다 `focus-visible:rounded-*` 를 덧붙이지 않는다. `html` 의 `scroll-padding-top` 이 sticky 머리띠(72px)만큼 띄워서 Tab 으로 옮긴 초점이 머리띠 밑에 숨지 않는다.
- **그림자를 쓰지 않는다.** `shadow-card`·`shadow-panel` 은 `none` 이다. 겹침은 바탕색과 괘선으로만 가른다.
  - 예외는 머리띠 하나다. `shadow-header` 를 `border-b border-line` 과 같이 쓴다. 머리띠는 바탕과 같은 흰색이라
    괘선만으로는 스크롤한 내용이 밑으로 지나가는 것이 안 보인다. 다른 곳에는 쓰지 않는다.
- **회색 판으로 가르지 않는다.** 흰 바탕에 간격으로 가르고, 경계가 꼭 필요한 덩어리만 `Card`(흰 상자 + `border-line`)로 싼다. 위 「회색 규칙」.
- 표는 패널에 넣지 않는다. 머리 위 굵은 괘선(`border-t-2 border-rule`) 하나, 행 사이 얇은 괘선, 숫자는 오른쪽 정렬.
- **표 칸과 버튼의 글자는 줄을 바꾸지 않는다.** `Table` 칸과 `Button` 에 `whitespace-nowrap` 이 들어 있다. 긴 가맹점명은 그 칸에서 `truncate` 로 말줄임한다(열에 `width: 'w-full max-w-0'`).
- 전환: `transition-colors duration-150 ease-snap`. 등장 애니메이션은 `animate-rise` 하나.
- **움직임은 첫 화면 큰 판에서만** (`OrbitStage`). 앱 화면은 차분하게 둔다 — 세금 판정 화면에서 화려한 연출은 신뢰를 깎는다.
- 궤도 애니메이션은 `animate-orbit`(52초) / `animate-orbit-slow`(78초)와 짝이 되는 역회전(`-back`)을 함께 건다. 역회전을 빼면 그림이 뒤집힌다.
- 움직이는 것에는 `motion-reduce:animate-none` 을 붙이고, 타이머는 `prefers-reduced-motion` 을 보고 멈춘다.

## 부품

### Button
```tsx
<Button to="/login" size="lg">무료로 판정해보기</Button>          // 라우터 링크
<Button href="#system" variant="ghost" size="inline">보기 →</Button>  // 앵커
<Button type="submit" variant="secondary" size="md">저장</Button>   // 버튼
```
- `variant`: `primary`(파란 알약) · `secondary`(테두리 알약) · `soft`(연회색) · `ghost`(밑줄 친 텍스트 링크) · `danger`(빨강)
- `danger` 는 **되돌릴 수 없는 동작에만**, 한 화면에 하나. 그런 동작은 항상 `Modal` 로 한 번 더 묻는다.
- `size`: `sm` 헤더·표 안(36px) · `md` 폼과 화면의 주 버튼(48px) · `lg` 랜딩 CTA(56px) · `inline` 문장 속 링크(ghost 전용)
- **모양은 알약 하나, 높이는 이 셋뿐이다.** 화면에서 `rounded-xl`·`h-*`·`disabled:bg-line` 으로 버튼을 따로 만들지 않는다. 폼 제출은 `<Button type="submit">`, 꽉 채우려면 `className="w-full"`.
- 막힌 버튼은 모든 variant 가 `opacity-40` 하나다. 회색으로 바꾸거나 다른 불투명도를 쓰지 않는다.
- 둘을 나란히 둘 때는 `[secondary][primary]` 순서로 오른쪽에 붙인다(`justify-end`).
- 한 뷰포트 안에 `primary`는 하나. 나머지 행동은 `secondary`/`soft`. 예외: 랜딩 끝의 CTA가 히어로 CTA와 같은 목적지를 반복하는 것은 허용 (스크롤로 떨어져 있고 행동이 하나이므로).
- 되돌릴 수 없는 동작은 현재 **업로드 배치 삭제 하나뿐**이다(`/uploads`). 지우면 그 배치에서 나온 거래·판정·되묻기 답변·사용자 수정까지 함께 사라진다(api.md 3.3). 그래서 `Modal` 로 한 번 더 묻고, 무엇이 함께 사라지는지 `description` 에 적는다.
- 제출·외부 발송처럼 돌이킬 수 없는 동작은 아직 없다. 새로 생기면 **이 문서를 먼저 고치고** 버튼을 만든다.

### Card
`tone` canvas(흰 상자 + `border-line`, 기본)·ink(검정), `padding` sm(28)·md(32)·lg(40/48), `as` div·article·section·li.
회색 tone 은 없앴다. 카드를 회색으로 칠하지 않는다.
목록 항목이면 `as="li"`, 독립된 내용이면 `as="article"`.

### Badge / VerdictBadge
- 판정 3분류는 항상 `VerdictBadge verdict={judgment.verdict}` — API의 `{code, label}`을 그대로 넘긴다. 라벨은 API 값, 기호·색은 `utils/verdict.ts`의 `VERDICT_META`.
- 상태값(`verdict`·`status`·`state`)의 표시 문자열을 프론트에 하드코딩하지 않는다. 분기는 `code`, 표시는 `label`.
- 그 외 상태 표시(업로드 상태, 후보 상태, 보는 중)는 `Badge`(neutral)나 `tone="ink"`. `ok·warn·deny` 를 쓰지 않는다. 다크 배경 위에서는 `tone="inverse"`.

### StatuteCitation
- `statuteVersionId`로 조문 1건. `GET /statutes/{id}` 응답(제목·시행일·버전·원문 링크)을 그대로 보여준다.
- `hierarchy` 로 근거 위계를 나눠 보여준다(CONTEXT.md §6). 나누지 않으면 사용자가 판례·예규를 법령과 같은 무게로 읽는다.
  - 법률·시행령·시행규칙: 「근거」(ink 배지, 흰 바탕)
  - 기본통칙·예규: 「참고 해석기준」 + 「법적 구속력은 없습니다」 안내. 고시도 「참고 해석기준」이지만 위임 고시는 구속력이
    있을 수 있어 안내를 붙이지 않는다(ai/pipeline 은 위임 고시를 확정 근거로 쓴다 — 팀 확인 필요).
  - 심판례·판례: 「참고 사례」 + 「개별 사건의 판단입니다」 안내
  - 목록에 없는 값(훈령·해석례 등): 「참고 (값)」으로 낮춘다. 참고는 모두 neutral 배지 + canvas 바탕.
  - 조문을 불러오지 못하면 조용히 빼지 않고 「조문을 불러오지 못했습니다」를 남긴다.

### SectionHeading
`eyebrow → title → description` 순서 고정. `size` page·lg·md(기본)·sm. 다크 배경은 `inverse`.
- `size="page"` 는 로그인 뒤 화면의 머리다. 작은 accent eyebrow + 28px **h1**(기본 태그) — 흐름 화면의 `StepEyebrow` + h1 과 같은 모양이다. 내 정보·관리자처럼 단계가 없는 화면이 쓴다.
- lg(h1)·md(h2)·sm(h3) 는 공개 화면(FAQ·버그 신고)과 랜딩 섹션 제목이다.
- 화면마다 h1 은 하나다. 빵부스러기, 탭 제목, eyebrow, h1 은 같은 화면 이름을 쓴다.
- `description` 은 없어도 되면 넣지 않는다(아래 문구 규칙).

### Container
모든 섹션 내용은 이 안에 둔다. 띠를 회색으로 칠하지 않는다. 괘선으로 가르려면 `border-y border-line`.

### ChoiceGroup
- 단일 선택지 3~6개 (문진, 질문 응답). `value`는 문자열 또는 불리언.
- 고르지 않은 칸은 흰 바탕 + `border-edge`, hover 는 `surface`. 고른 칸은 `border-accent` + `accent-soft` 바탕 + `accent-hover` 글자다. 힌트는 `ink2`.
- **있지만 아직 동작하지 않는 선택지는 `disabled: true`** — 흐리게 보이고 눌리지 않으며 '준비 중'이 붙는다. 다른 직종처럼 "보여는 주되 IT만 동작"할 때 쓴다.
- 눌리는데 아무 일도 일어나지 않는 버튼은 만들지 않는다. 사용자는 그걸 고장으로 읽는다.

### Modal
- **되돌릴 수 없는 동작 앞에서만** 쓴다. 단순 안내나 부가 정보에는 쓰지 않는다.
- `description` 에 **무엇이 함께 사라지는지** 적는다. "정말 삭제하시겠습니까?" 만으로는 부족하다.
- Esc·바깥 클릭으로 닫힌다. 열리면 첫 조작 요소로 초점이 가고, Tab 은 대화상자 안에서만 돈다. 닫으면 열었던 버튼으로 초점이 돌아간다. 확인 버튼은 `variant="danger"`.
- 조회·저장 실패 문구는 **대화상자 안에** 둔다. 뒤 화면에 두면 백드롭에 가려 보이지 않는다.

### Table · Pagination
- 목록 표. 정렬·페이지네이션은 **서버가** 하고 부품은 그리기만 한다 (`page` 는 0-based).
- `hideBelow` 로 좁은 화면에서 숨길 열을 고른다. 금액·상태처럼 **핵심 정보에는 쓰지 않는다**.
- 행 클릭이 필요하면 `onRowClick`. 행 안에 버튼이 함께 있으면 클릭 대상이 겹치므로 둘 중 하나만 쓴다.
- 고른 행(`selectedKey`)은 `accent-soft`, hover 는 `surface` 다. 고른 행에는 hover 를 걸지 않는다.
- `loading` 이면 골격 5줄을 보여준다. 첫 로딩에만 쓰고 필터 전환에는 이전 결과를 유지한다.
- **헤더의 합계를 현재 페이지 배열로 더하지 않는다.** `page.totalElements` 나 서버가 주는 집계(`unresolved`)를 쓴다. 기본 페이지 크기는 20이므로(api.md 3.1) 20개를 넘는 순간 틀린다.
- 마지막 행이 목록에서 빠지면 그 페이지가 비는데, `Pagination` 이 사라져 되돌아갈 수 없다. 비면 첫 페이지로 되돌린다.

### FilterBar
- 선택지 5개 안쪽, 서로 배타적일 때. 그보다 많거나 축이 여럿이면 `Select`.
- 건수를 함께 보여줄 수 있다(`count`). 서버가 준 값만 쓰고 화면에서 세지 않는다. 건수를 흐리게(opacity) 하지 않는다.
- 고른 것은 `bg-accent` 흰 글자, 나머지는 `ink2` + hover `surface`.
- `role="group"` + `aria-pressed` 버튼 묶음이다. 탭(`tablist`)이 아니다 — 보여줄 `tabpanel` 이 따로 없고 같은 목록을 걸러내기만 하므로, 탭의 키보드 규약(화살표 이동)이 맞지 않는다.

### Empty
- 목록이 비었을 때. **"없음"이 아니라 "왜 없는지"** 를 말하고, 다음에 할 행동이 있으면 `action` 에 버튼 하나만 둔다.
- 문장 하나(`title`)와 동작 하나(`action`)가 기본이다. `description` 은 왜 없는지가 제목만으로 안 보일 때만.
- `tone="ok"` 는 비어 있는 것이 좋은 결과일 때만 (확인할 항목을 다 처리한 경우). 초록이 아니라 accent 아이콘이다.
- `tone="error"` 는 **화면 전체**를 불러오지 못했을 때만 쓴다. 붉은 상자를 쓸 수 있는 유일한 자리다.
- 필터로 걸러 낸 표가 비었으면 `inTable` 이다. 점선 상자 대신 표 머리의 굵은 괘선 아래를 비운다. 필터 바로 밑에 상자가 붙으면 필터와 한 덩어리로 보인다. `Table` 의 `className`(간격)은 빈 상태에도 걸린다.
- **조회가 실패한 것을 "없다"고 말하지 않는다.** `useApi` 의 `error` 를 먼저 보고, 실패면 "불러오지 못했습니다" + `다시 시도` 를 준다. 실패를 빈 목록으로 그리면 서버 장애가 정상 상태로 읽힌다.
- 같은 이유로 "다 처리했습니다"는 **다 읽은 뒤 0건일 때만** 쓴다. 로딩 중 0건은 아직 모르는 상태다.

### OrbitStage
- 첫 화면 큰 판 안에서만 쓴다. 동심원 위를 그림이 돌고 가운데 문구가 바뀐다.
- 바탕이 `surface2`(남색)라 그림은 흰 바탕 + 먹색 획으로 그린다. 외곽선은 두지
  않는다 — 남색 바탕이 이미 테두리 역할을 한다.
- 바깥 테 52초(시계) / 안쪽 테 78초(반시계). 테가 도는 만큼 그림에 **역회전을 같은 주기로** 걸어야 그림이 안 뒤집힌다.
- 궤도는 **정사각 판 안에서** 돈다. 가로·세로 %를 따로 쓰면 원이 아니라 타원이 되어 그림이 좌우 끝으로 밀린다.
- 그림이 제목·가운데 문구를 덮지 않도록 중심을 오른쪽(66%)으로 비키고 안쪽 반지름을 34% 이상으로 둔다.
- 좁은 화면(`lg` 미만)에서는 그림을 돌리지 않고 옅은 테만 남긴다. 판 밖으로 나가고 제목과 겹친다.
- `motion-reduce:animate-none` + 타이머는 `prefers-reduced-motion` 을 보고 멈춘다.
- 문구는 파일 맨 위 `CENTER_LINES` 한 곳에서만 고친다.
- 그림은 **우리 색으로 직접 그린 SVG** 다. 레퍼런스 사이트의 그림은 그쪽 자산이라 가져오지 않는다.

### Field · Input · Select
- 라벨 `body-lg bold`, 힌트 `small ink2`, 오류 `small deny` + `role="alert"`.
- 입력칸 테두리는 `edge`, 바탕은 흰색. 잘못 넣은 칸에는 `aria-invalid` 를 건다 — 테두리가 `deny` 로 바뀐다. 오류 문구 한 줄과 테두리를 같이 쓰고, 칠한 상자로 감싸지 않는다.
- 지켜야 할 조건(비밀번호 규칙 같은)을 placeholder 에만 두지 않는다. 입력하면 사라진다.
- 입력은 기본 `w-full`. 폭을 줄이려면 `className`이 아니라 감싸는 div에 폭을 준다 (클래스 충돌 회피).

## 말투·표현 규칙 (코드가 못 막는 것)

- **AI가 판정한다고 쓰지 않는다.** 판정은 규칙 엔진이 한다. AI는 분류까지. 카피에 "AI가 판단", "AI 추천" 금지.
- **결과에는 근거가 붙는다.** 판정을 보여주는 모든 화면에 `StatuteCitation`이 있어야 한다. 근거 없는 판정 UI는 만들지 않는다.
- **단정하지 않는다.** "가능합니다" 대신 "가능, 근거 2건". 확인 필요는 실패가 아니라 "질문 하나 더"로 표현한다.
- **하지 않는 일을 먼저 말한다.** 전자신고·세액 확정·금전 이동을 암시하는 UI 요소를 만들지 않는다.
- 문장은 짧게, 합니다체. 해요체를 섞지 않는다. 느낌표 안 쓴다.

**덜 보여 준다** (11/5 치오). 화면마다 설명 문장, 번호, 기호, 회색이 많았다.

1. **할 일을 돕지 않는 안내문은 뺀다.** 「카카오 계정은 이메일 계정과 따로입니다」, 「판정 이력과 저장된 답변은 계정에 묶여 관리됩니다」 같은 것.
2. **캡션을 달지 않는다.** 제목 아래 부제, 뻔한 것을 다시 말하는 도움 문단, 안쪽 동작 설명, 각주를 넣지 않는다.
   남기는 것: h1, 보고도 무엇을 할지 모를 때의 한 줄, 오류 문구, 빈 상태(문장 하나 + 동작 하나), 공통 고지(`DISCLAIMER`), 잘못되거나 되돌릴 수 없는 동작을 막는 문장.
   공통 고지는 앱 위의 띠(`DisclaimerBar`)와 앱 꼬리말에 있다. 띠는 닫을 수 있고 닫은 것을 브라우저에 남긴다. 꼬리말의 문장은 닫히지 않고 인쇄(PDF)에도 들어간다.
3. **번호와 id 를 보이지 않는다.** 버전·리비전 번호(v1, rev.1, 버전 #N), 규칙 카드 id(R-…), 게이트 코드(G0–G6), 실행·커밋 id, enum·필드 이름, 서버 코드와 HTTP 상태. 이력이 필요하면 날짜로 보인다. 조문은 id(`소득세법-33-1`) 대신 `statuteTitle()` 로 「소득세법 제33조 제1항」.
4. **가운뎃점(· ・ •)과 낫표(「」『』)를 화면 글에 쓰지 않는다.** JSX 글자, aria-label, title, placeholder, 토스트, 오류 문구, 탭 제목, alt 모두다. 쉼표, 줄바꿈, 간격, 굵게로 나눈다. 코드 주석·테스트·문서는 써도 된다.
5. **개발 용어를 쓰지 않는다.** 파싱, 파서, 적재, 컬럼, 해시, 매칭, 게이트, run, batch, rev.
6. **같은 것은 같은 이름으로 부른다.** 화면 이름은 카드내역 올리기, 분류 확인, 판정 전 확인, 판정, 결과, 질문, 요약, 거래, 업로드 이력, 내 정보, 사업자 문진, 관리자. 판정은 가능, 확인 필요, 불가. 질문에 답을 기다리는 추정 불가는 답변 대기, 업종이 없는 가맹점은 분류 필요. 가능 금액의 합은 경비 가능 금액. 사람은 세무사(약관·처리방침 본문만 예외). 카드사는 KB국민카드, IBK기업은행, 파일은 승인내역.

## 화면을 새로 만들 때

- **라우트를 추가하면 그 화면으로 가는 링크도 같이 넣는다.** 5단계 흐름에 속하면 `AppShell` 의 `STEPS`(또는 `STEP_ALIAS`), 흐름 밖의 자료 화면이면 `REFS` 에 넣는다. 주소를 직접 쳐야만 닿는 화면은 없는 화면이다.
- 검증할 때 `history.pushState` 로 건너뛰지 말고 **링크를 눌러서** 들어가 본다. 그러지 않으면 닿을 수 없는 화면을 "동작한다"고 적게 된다.

## 새 부품이 필요할 때

1. 기존 부품의 `variant`/`tone`으로 되는지 먼저 본다.
2. 안 되면 `ui/`에 추가하고 `/styleguide`에 예시를 넣는다. 예시 없는 부품은 없는 부품이다.
3. 이 문서의 표를 갱신한다.

토큰을 바꿨으면 `npm run check:tokens` 로 이 문서·`/styleguide` 와 어긋나지 않는지 본다.
잊으면 스타일가이드가 거짓말을 한다 — 실제로 그런 적이 있다(옛 `#0B7A4B` 가 팔레트 교체 뒤에도 남아 있었다).

## 아직 없는 것 (앱 화면 명세 뒤 추가 예정)

Toast/알림, 파일 드롭존, Drawer, StatTile, Timeline.
- 파일 드롭존은 `/upload` 한 곳에서만 쓰여 그 화면 안에 두었다(`Upload.tsx` 의 `DropZone`). 두 번째로 필요해지면 `ui/` 로 뽑는다.
- Tabs 는 만들지 않았다. 목록 필터는 `FilterBar`(버튼 묶음)로 하고, 보여줄 패널이 갈리는 진짜 탭이 필요해지면 그때 만든다.
- 진행 표시는 `AppShell` 의 단계 표시와, `Run`·`ClassificationPreview` 가 각자 그리는 진척 바가 있다. 같은 모양이 세 번째로 필요해지면 `Progress` 로 뽑는다.
- `Interview` 는 아직 옛 클래스(생 px)가 남아 있다. `Upload`·`Confirm`·`Run`·`Transactions`·`Uploads`·`ClassificationPreview`·`AppShell`·`Results`·`Summary`·`Questions` 는 토큰으로 옮겼다.
