# frontend

PreeT 웹 프론트엔드. Vite + React 18 + TypeScript + Tailwind CSS.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
```

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 (`dist/`). 끝에 공개 페이지를 미리 그린다(아래 「검색 노출」) |
| `npm run lint` | ESLint |
| `npm test` | 단위 테스트 (vitest) |

타입 검사: `npx tsc --noEmit`

## 구조

```
src/
  api/             API 레이어 — contract.ts(명세 3.1~3.7 함수 시그니처), hooks.ts(useApi), mock/(목업 구현·데이터)
  components/ui/   공용 부품 (Button, Card, Badge, SectionHeading, Container, Field·Input·Select, ChoiceGroup)
  components/      도메인 부품 (VerdictBadge, StatuteCitation, OrbitStage, AppShell …)
  pages/           라우트별 화면 (Landing, Login, Upload, Interview, …, Styleguide)
  parser/          카드내역 파서 — KB국민·IBK기업 승인내역 .xls 를 브라우저에서 읽어 업로드 요청으로 바꾼다
  mock/            화면 전용 목업 (마케팅 카피, 히어로 트레이스)
  contexts/        세션 상태 (로그인, 현재 batch·context·run id)
  types/           도메인 타입 (API 명세와 1:1)
  utils/           포맷·판정 메타
  seo.ts           공개 페이지 목록과 검색·공유용 제목·설명
  entry-server.tsx 빌드 때만 쓰는 서버 렌더 입구
scripts/
  prerender.mjs    공개 페이지 HTML·robots.txt·sitemap.xml·llms.txt 생성
```

## 검색 노출

크롤러와 카카오톡 미리보기는 자바스크립트를 돌리지 않거나 덜 돌려서, 빈 `#root` 만 받으면 본문·제목을 못 본다. 그래서 `npm run build` 끝에 `npm run prerender` 가 돈다.

1. `vite build --ssr src/entry-server.tsx` 로 서버 렌더 묶음(`dist-ssr/`)을 만든다.
2. `scripts/prerender.mjs` 가 `seo.ts` 의 `PAGES` 마다 화면을 그려 `dist/<file>` 로 쓴다. title·description·canonical·og 태그도 채운다.
3. 본문 없는 `dist/app.html`(noindex)을 쓴다. 웹 서버가 공개 페이지가 아닌 주소에 이것을 낸다(`deploy/caddy/Caddyfile`).
4. `robots.txt`·`sitemap.xml`·`llms.txt` 를 쓴다.

- 공개 페이지를 더하면 `seo.ts` 의 `PAGES` 에 넣는다. 빠지면 크롤러에게는 빈 화면이 나간다.
- 미리 그린 페이지에 h1 이 1개가 아니거나 본문이 200자 미만이면 빌드가 실패한다. 화면 코드가 서버 렌더에서 빈 껍데기만 내는 사고를 막는다.
- 서버 렌더에는 `window`·`document` 가 없다. 공개 페이지의 첫 렌더(컴포넌트 본문, `useState` 초기값)에서 읽지 말고 effect 안에서 읽는다.
- 브라우저는 hydrate 하지 않고 미리 그린 마크업을 지운 뒤 다시 그린다(`index.tsx` 의 `createRoot`).
- 랜딩 첫 방문은 인트로가 덮는다. 미리 그린 본문이 인트로보다 먼저 보이지 않게 `index.html` 이 인트로 색 판(`intro-cover`)을 미리 깔고, `Landing` 이 뜨면 걷는다.

## 데이터 흐름

화면은 `api.*` 만 호출한다. `src/api/index.ts` 가 지금은 `mock` 구현을 내보내고, 백엔드가 준비되면 여기서 http 구현으로 바꾼다. 화면 코드는 그대로.

```tsx
import { api, useApi } from '../api';

const { data, loading, error, reload } = useApi(() => api.judgments.list({ runId }), [runId]);
await api.questions.respond({ questionIds, answer: { value } });
```

- 서버 상태(판정·질문·집계)는 화면이나 Context에 두지 않는다. 항상 `api.*` 로 읽고, 바꾼 뒤엔 `reload()`.
- 목업 구현은 재판정·Revision·집계를 인메모리로 흉내 낸다. 새로고침하면 초기화된다.
- 진행률은 `api.runs.get` 1초 폴링. SSE 토큰 방식이 정해지면 교체한다.

## 디자인 시스템

- 규칙·토큰 표: [`DESIGN.md`](DESIGN.md)
- 실물 쇼케이스: 개발 서버에서 `/styleguide`
- 토큰 정의: [`tailwind.config.js`](tailwind.config.js)

새 화면은 `src/components/ui`의 부품과 토큰만으로 만든다. 없는 부품은 `DESIGN.md` 끝의 목록을 보고 추가한다.

## 현재 상태

- 랜딩 페이지는 디자인 시스템 부품으로 구성됨
- 앱 화면은 `api` 목업으로 동작. 업로드 → 분류 확인 → 문진 → 판정 → 결과 → 되묻기 순
- `/upload` 는 파일을 브라우저에서 읽고(`src/parser/`) `POST /upload-batches` 로 보낸다. 샘플 파일은 실서버에서도 보이고, 실서버에서 올리면 그 계정의 업로드 이력에 남는다
- `/preview` `/uploads` `/transactions` `/account` 는 라우트만 있는 빈 화면
- 백엔드 연동 없음
