# 경비판정 디자인 시스템 (초안)

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
| `canvas` | #FFFFFF | 페이지 바탕 |
| `surface` | #F5F6F8 | 패널, 카드 |
| `surface2` | #FFE600 | 첫 화면 큰 판 (한 곳뿐) |
| `sheet` | #FFFFFF | 패널 위에서 흰 바탕이 필요할 때, 표 |
| `line` / `line2` | #ECEEF1 / #F5F6F8 | 테두리·행 괘선 / 약한 구분선 |
| `rule` | #1A1A1A | 표 머리 위 굵은 괘선 |
| `ink` / `ink2` / `muted` | #0A0A0A / #2B2B2B / #5D6670 | 제목·강조 / 본문 / 보조 |
| `accent` | #0A0A0A | 주된 동작, 지금 자리 알약 |
| `accent-hover` / `accent-soft` / `accent-line` | #2B2B2B / #F5F6F8 | primary hover / 연한 채움 / 테두리 버튼·패널 안 구분선 (#DDE1E6) |
| `link` | #1A6DFF | 문장 속 링크 |
| `highlight` | #FFE600 | 한 화면에 한 번만 쓰는 강조 |
| `ok` / `ok-bg` / `ok-line` / `ok-bar` | #00703D / #E6F8F0 / #A8E6C9 / #12B76A | 가능 |
| `warn` / `warn-bg` / `warn-line` / `warn-bar` | #955A00 / #FFF6E0 / #FFD98A / #F7A51B | 확인 필요 |
| `deny` / `deny-bg` / `deny-line` / `deny-bar` | #C92A2A / #FFEDED / #FFC4C4 / #FF5A5A | 불가 |

**상태색 규칙**
- `ok·warn·deny`는 `bg + line + text` 세 개를 항상 세트로 쓴다. 글자만 빨갛게 하지 않는다.
- 색만으로 상태를 말하지 않는다. 판정 배지에는 기호(✓ ? ✕)가 반드시 붙는다 → `VerdictBadge` 사용.
- 상태색은 **판정 결과(verdict)·분류 상태(classificationStatus)** 와 **실패·막힘 안내**에만 쓴다.
  - verdict·classificationStatus: 계약이 `NEEDS_REVIEW` 로 부르는 "사람 확인이 필요하다"는 둘 다 같은 뜻이다.
  - 실패·막힘: API 오류 박스·판정 실패 카드는 `deny`, 진행을 막는 선행조건 안내는 `warn`. 되돌릴 수 없는 동작의 `Modal` 제목과 `danger` 버튼도 `deny`.
  - "성공했습니다" 토스트에 `ok` 를 쓰지 않는다. 잘 된 것은 색으로 말하지 않는다.
- `bg + line + text` 세트 규칙은 **박스**에 적용된다. 한 줄 문구나 버튼처럼 박스가 아닌 곳은 글자색(또는 버튼 배경)만 쓴다.
- **글자색과 채움색을 섞지 않는다.** `ok·warn·deny` 는 글자용이라 대비(4.5:1) 때문에 어둡다. 막대·점처럼 글자가 안 올라가는 채움에는 `ok-bar·warn-bar·deny-bar` 를 쓴다. 글자색을 막대에 쓰면 `warn` 이 갈색 막대가 된다.
- 색을 바꾸면 **대비를 다시 잰다.** 글자색은 자기 `-bg` 위에서 4.5:1 이상이어야 한다. 현재 값은 ok 5.63 · warn 5.22 · deny 4.83 · muted 5.39(패널 위)다.

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
- **그림자를 쓰지 않는다.** `shadow-card`·`shadow-panel` 은 `none` 이다. 겹침은 바탕색과 괘선으로만 가른다.
- **패널에 테두리를 두르지 않는다.** 흰 바탕 위 `surface` 회색으로만 가른다. 테두리가 필요한 것은 표의 행 괘선과 `secondary` 버튼뿐이다.
- 표는 패널에 넣지 않는다. 머리 위 굵은 괘선(`border-t-2 border-rule`) 하나, 행 사이 얇은 괘선, 숫자는 오른쪽 정렬.
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
- `variant`: `primary`(검정 알약) · `secondary`(테두리 알약) · `soft`(연회색) · `ghost`(밑줄 친 텍스트 링크) · `danger`(빨강)
- `danger` 는 **되돌릴 수 없는 동작에만**, 한 화면에 하나. 그런 동작은 항상 `Modal` 로 한 번 더 묻는다.
- `size`: `sm` 헤더·표 안 · `md` 폼 · `lg` 랜딩 CTA · `inline` 문장 속 링크(ghost 전용)
- 한 뷰포트 안에 `primary`는 하나. 나머지 행동은 `secondary`/`soft`. 예외: 랜딩 끝의 CTA가 히어로 CTA와 같은 목적지를 반복하는 것은 허용 (스크롤로 떨어져 있고 행동이 하나이므로).
- 되돌릴 수 없는 동작은 현재 **업로드 배치 삭제 하나뿐**이다(`/uploads`). 지우면 그 배치에서 나온 거래·판정·되묻기 답변·사용자 수정까지 함께 사라진다(api.md 3.3). 그래서 `Modal` 로 한 번 더 묻고, 무엇이 함께 사라지는지 `description` 에 적는다.
- 제출·외부 발송처럼 돌이킬 수 없는 동작은 아직 없다. 새로 생기면 **이 문서를 먼저 고치고** 버튼을 만든다.

### Card
`tone` surface(회색 패널, 기본)·canvas(테두리 친 흰 바탕)·ink(검정), `padding` sm(28)·md(32)·lg(40/48), `as` div·article·section·li.
목록 항목이면 `as="li"`, 독립된 내용이면 `as="article"`.

### Badge / VerdictBadge
- 판정 3분류는 항상 `VerdictBadge verdict={judgment.verdict}` — API의 `{code, label}`을 그대로 넘긴다. 라벨은 API 값, 기호·색은 `utils/verdict.ts`의 `VERDICT_META`.
- 상태값(`verdict`·`status`·`state`)의 표시 문자열을 프론트에 하드코딩하지 않는다. 분기는 `code`, 표시는 `label`.
- 그 외 상태 표시는 `Badge tone=...`. 다크 배경 위에서는 `tone="inverse"`.

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
`eyebrow → title → description` 순서 고정. `size` lg(h1)·md(h2, 기본)·sm(h3). 다크 배경은 `inverse`.

### Container
모든 섹션 내용은 이 안에 둔다. 배경색이 있는 띠 섹션은 `<section class="bg-surface"><Container>…` 구조. `canvas` 는 페이지 바탕(흰색)이라 띠로 쓰면 보이지 않는다. 괘선으로만 가르려면 `border-y border-line`.

### ChoiceGroup
- 단일 선택지 3~6개 (문진, 질문 응답). `value`는 문자열 또는 불리언.
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
- `loading` 이면 골격 5줄을 보여준다. 첫 로딩에만 쓰고 필터 전환에는 이전 결과를 유지한다.
- **헤더의 합계를 현재 페이지 배열로 더하지 않는다.** `page.totalElements` 나 서버가 주는 집계(`unresolved`)를 쓴다. 기본 페이지 크기는 20이므로(api.md 3.1) 20개를 넘는 순간 틀린다.
- 마지막 행이 목록에서 빠지면 그 페이지가 비는데, `Pagination` 이 사라져 되돌아갈 수 없다. 비면 첫 페이지로 되돌린다.

### FilterBar
- 선택지 5개 안쪽, 서로 배타적일 때. 그보다 많거나 축이 여럿이면 `Select`.
- 건수를 함께 보여줄 수 있다(`count`). 서버가 준 값만 쓰고 화면에서 세지 않는다.
- `role="group"` + `aria-pressed` 버튼 묶음이다. 탭(`tablist`)이 아니다 — 보여줄 `tabpanel` 이 따로 없고 같은 목록을 걸러내기만 하므로, 탭의 키보드 규약(화살표 이동)이 맞지 않는다.

### Empty
- 목록이 비었을 때. **"없음"이 아니라 "왜 없는지"** 를 말하고, 다음에 할 행동이 있으면 `action` 에 버튼 하나만 둔다.
- `tone="ok"` 는 비어 있는 것이 좋은 결과일 때만 (확인할 항목을 다 처리한 경우).
- **조회가 실패한 것을 "없다"고 말하지 않는다.** `useApi` 의 `error` 를 먼저 보고, 실패면 "불러오지 못했습니다" + `다시 시도` 를 준다. 실패를 빈 목록으로 그리면 서버 장애가 정상 상태로 읽힌다.
- 같은 이유로 "다 처리했습니다"는 **다 읽은 뒤 0건일 때만** 쓴다. 로딩 중 0건은 아직 모르는 상태다.

### OrbitStage
- 첫 화면 큰 판 안에서만 쓴다. 동심원 위를 그림이 돌고 가운데 문구가 바뀐다.
- 바깥 테 52초(시계) / 안쪽 테 78초(반시계). 테가 도는 만큼 그림에 **역회전을 같은 주기로** 걸어야 그림이 안 뒤집힌다.
- 궤도는 **정사각 판 안에서** 돈다. 가로·세로 %를 따로 쓰면 원이 아니라 타원이 되어 그림이 좌우 끝으로 밀린다.
- 그림이 제목·가운데 문구를 덮지 않도록 중심을 오른쪽(66%)으로 비키고 안쪽 반지름을 34% 이상으로 둔다.
- 좁은 화면(`lg` 미만)에서는 그림을 돌리지 않고 옅은 테만 남긴다. 판 밖으로 나가고 제목과 겹친다.
- `motion-reduce:animate-none` + 타이머는 `prefers-reduced-motion` 을 보고 멈춘다.
- 문구는 파일 맨 위 `CENTER_LINES` 한 곳에서만 고친다.
- 그림은 **우리 색으로 직접 그린 SVG** 다. 레퍼런스 사이트의 그림은 그쪽 자산이라 가져오지 않는다.

### Field · Input · Select
- 라벨 `body-lg bold`, 힌트 `small muted`, 오류 `small deny` + `role="alert"`.
- 입력은 기본 `w-full`. 폭을 줄이려면 `className`이 아니라 감싸는 div에 폭을 준다 (클래스 충돌 회피).

## 말투·표현 규칙 (코드가 못 막는 것)

- **AI가 판정한다고 쓰지 않는다.** 판정은 규칙 엔진이 한다. AI는 분류까지. 카피에 "AI가 판단", "AI 추천" 금지.
- **결과에는 근거가 붙는다.** 판정을 보여주는 모든 화면에 `StatuteCitation`이 있어야 한다. 근거 없는 판정 UI는 만들지 않는다.
- **단정하지 않는다.** "가능합니다" 대신 "가능 · 근거 2건". 확인 필요는 실패가 아니라 "질문 하나 더"로 표현한다.
- **하지 않는 일을 먼저 말한다.** 전자신고·세액 확정·금전 이동을 암시하는 UI 요소를 만들지 않는다.
- 문장은 짧게, 존댓말 "-합니다". 느낌표 안 쓴다.

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
