# frontend

경비판정 웹 프론트엔드. Vite + React 18 + TypeScript + Tailwind CSS.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
```

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 (`dist/`) |
| `npm run lint` | ESLint |

타입 검사: `npx tsc --noEmit`

## 구조

```
src/
  api/             API 레이어 — contract.ts(명세 3.1~3.7 함수 시그니처), hooks.ts(useApi), mock/(목업 구현·데이터)
  components/ui/   공용 부품 (Button, Card, Badge, SectionHeading, Container, Field·Input·Select, ChoiceGroup)
  components/      도메인 부품 (VerdictBadge, StatuteCitation, AgentPreview, AppShell …)
  pages/           라우트별 화면 (Landing, Login, Upload, Interview, …, Styleguide)
  mock/            화면 전용 목업 (마케팅 카피, 히어로 트레이스, 업로드 샘플 파일)
  contexts/        세션 상태 (로그인, 현재 batch·context·run id)
  types/           도메인 타입 (API 명세와 1:1)
  utils/           포맷·판정 메타
```

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
- `/preview` `/uploads` `/transactions` `/account` 는 라우트만 있는 빈 화면
- 백엔드 연동 없음
