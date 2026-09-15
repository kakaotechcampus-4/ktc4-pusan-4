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
  components/ui/   공용 부품 (Button, Card, Badge, SectionHeading, Container, Field·Input·Select)
  components/      도메인 부품 (VerdictBadge, StatuteCitation, AgentPreview, AppShell …)
  pages/           라우트별 화면 (Landing, Login, Upload, Interview, …, Styleguide)
  mock/            목업 데이터 (판정 샘플, 조문, 마케팅 카피)
  contexts/        세션 상태
  types/           도메인 타입
  utils/           포맷·판정 메타
```

## 디자인 시스템

- 규칙·토큰 표: [`DESIGN.md`](DESIGN.md)
- 실물 쇼케이스: 개발 서버에서 `/styleguide`
- 토큰 정의: [`tailwind.config.js`](tailwind.config.js)

새 화면은 `src/components/ui`의 부품과 토큰만으로 만든다. 없는 부품은 `DESIGN.md` 끝의 목록을 보고 추가한다.

## 현재 상태

- 랜딩 페이지는 디자인 시스템 부품으로 구성됨
- 앱 화면(업로드·문진·판정·결과 등)은 기능·API 명세 확정 전 초안. 목업 데이터로 동작하며, 명세 확정 후 부품으로 교체 예정
- 백엔드 연동 없음
