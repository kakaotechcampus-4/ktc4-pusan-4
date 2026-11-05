# 공개 페이지를 크롤러가 읽게 프리렌더하고, 웹 서버와 히어로를 손봤다

- 브랜치: feature/seo
- 커밋: 26346c9..8dbb790 (8개)
- 주요파일: frontend/scripts/prerender.mjs, frontend/src/seo.ts, deploy/Caddyfile, frontend/src/components/HeroBanner.tsx

## 한 일

SEO 점검(/seo-audit, /fire-your-seo-agency) 1번 묶음을 구현했다. 운영 서버에서 JS 없이 받은 HTML은
`<title>PreeT</title>` 과 빈 `#root` 뿐이었다(h1 0개, 본문 5글자). robots·sitemap·없는 주소 요청에도
index.html 이 200 으로 나갔고, 압축·캐시·접근 기록이 없었다.

### 1. 공개 4페이지 프리렌더

- `src/seo.ts` 가 공개 페이지(`/`, `/faq`, `/terms`, `/privacy`)와 제목·설명의 단일 원본이다.
  화면의 탭 제목(`useDocumentTitle`)도 같은 값을 쓴다.
- `npm run build` 끝에 `npm run prerender` 가 돈다. `vite build --ssr src/entry-server.tsx` 로 서버 렌더 묶음을 만들고,
  `scripts/prerender.mjs` 가 페이지마다 `dist/<file>` 를 쓴다.
- 각 파일의 head 에는 title, description, canonical, og:*, twitter:card 를 넣는다.
- 가드: 페이지마다 h1 이 정확히 1개이고 본문이 200자 이상이 아니면 빌드가 실패한다.
- `App.tsx` 에서 라우트 부분을 `AppRoutes` 로 뺐다. 서버 렌더는 `StaticRouter` 로 감싼다.
- `Landing.tsx` 의 `wantsIntro` 는 `window` 가 없으면 false 를 돌려준다. 첫 렌더에서 window 를 읽는 곳은 여기 하나였다.
- h1 이 없던 곳에 h1 을 넣었다. 히어로 첫 문장은 `<strong>` 을 `<h1>` 으로 바꿨고, FAQ·버그 신고는 `SectionHeading as="h1"` 을 준다.
  보이는 모양은 같다.

### 2. 크롤러용 파일과 공유 미리보기

- `dist/app.html`: 본문 없이 noindex 를 단 SPA 틀이다. 공개 페이지가 아닌 주소(로그인 뒤 화면, 로그인, 없는 주소)는 모두 이것을 받는다.
- `robots.txt`: 검색엔진과 AI 크롤러(학습·검색·열람)를 모두 허용한다. sitemap 주소도 적었다.
- `sitemap.xml`: 4개 URL. lastmod 는 정확히 댈 근거가 없어 넣지 않았다.
- `llms.txt`: 한 줄 소개, 페이지 목록, 판정 근거(국가법령정보 OPEN API, 03:00 동기화), 지원 카드·업종, 하지 않는 일.
- `public/og-image.png`: 1200×630, 27KB. 브랜드 로고와 「개인 사업자를 위한 종합소득세 경비 판정 서비스」를 넣었다.
- 홈 제목은 `PreeT · 개인 사업자 종합소득세 경비 판정` 이다. 브랜드를 앞에 둔다. 다른 페이지는 `제목 · PreeT` 그대로다.

### 3. 인트로 덮개

프리렌더하면 첫 방문자에게 「본문 → 인트로 → 본문」 순서로 깜빡임이 생긴다.

- `index.html` 의 인라인 스크립트가 조건이 맞으면 `<html>` 에 `intro-cover` 를 단다.
  조건: `/`, 움직임 줄이기가 아님, `preet.intro.seen` 없음.
- CSS 가 인트로 색(`surface2`) 판을 z-40 으로 깐다. `Landing` 이 뜨면 걷는다.
- JS 가 끝내 실패해도 화면이 덮인 채로 남지 않게, 8초 뒤 걷는 타이머를 둔다.

### 4. 웹 서버(Caddy)

- `try_files {path} {path}index.html {path}.html /app.html`
- 화면 파일만 `encode zstd gzip`. JS 310KB 가 압축해 약 98KB 로 나간다.
- `/assets/*` 는 `Cache-Control: public, max-age=31536000, immutable`
- 접근 기록 `/data/access.log` 를 켰다.
  - 10MiB 파일 5개까지 둔다.
  - IP 는 앞 두 자리만 남긴다(IPv4 /16, IPv6 /32).
  - `/api/v1/*` 는 `log_skip` 으로 남기지 않는다.
- HSTS `max-age=31536000` 을 모든 https 응답에 붙인다.
- 개인정보처리방침의 수집 항목에 「접속 기록」 행을 넣고, 보관 방식을 2절에 한 줄 더했다.
- `docs/deployment.md` 13절에 라우팅, 크롤러 파일, 압축·캐시, HSTS, 접근 기록, 배포 뒤 확인 명령을 적었다.

### 5. 히어로 자동 넘김

- 4초마다 다음 장면으로 넘어간다. 손으로 넘기면 거기서 다시 센다.
- 3→1, 1→3 도 다른 걸음과 똑같이 한 칸 미끄러진다.
- 알약은 `번호 · 이전 · 멈춤(⏸/▶) · 다음` 순서다.
- 멈추는 경우:
  - 마우스가 올라가 있을 때(`pointerType === 'mouse'` 만 본다)
  - 키보드 포커스가 안에 있을 때(`:focus-visible` 만 본다)
  - 인트로가 덮고 있을 때(`<HeroBanner autoplay={!intro} />`)
- 움직임 줄이기 설정이면 멈춘 채로 시작하고, ▶ 로 켤 수 있다.
- 자동으로 넘어가는 동안에는 번호의 `aria-live` 를 off 로 둔다.

## 왜 이렇게 했나

- **hydrate 하지 않는다.** 세션 상태와 인트로 때문에 서버와 클라이언트의 첫 렌더가 어긋날 여지가 있다.
  `createRoot` 가 미리 그린 마크업을 지우고 다시 그린다. 공개 4페이지라 다시 그리는 비용은 작다.
- **로그인 뒤 경로를 robots 로 막지 않고 noindex 틀로 돌렸다.** robots 로 막으면 크롤러가 noindex 를 볼 수 없다.
  이 방법이 소프트 404 와 로그인 화면 중복을 한 번에 푼다. 상태 코드는 여전히 200 이다.
- **`{path}index.html` 을 따로 적었다.** `/` 에서 `{path}` 의 디렉터리 매칭이 Windows Caddy 에서는 실패해 noindex 틀이 나갔다.
  OS 에 따라 동작이 달라지지 않게 명시했다.
- **3→1 은 장면을 복제하지 않고 CSS `order` 로 옮겨 붙인다.**
  - #238 리뷰에서는 「부드럽게 끌면 2번을 거꾸로 훑어 되감기처럼 보인다」는 이유로 도는 걸음을 즉시 이동으로 했다.
    이번에는 갈 장면을 지금 장면 옆에 잠깐 붙이고 한 칸 미끄러진 뒤, 도착하면 `onScroll` 이 제자리로 돌린다.
  - 복제하지 않으니 h1 이 둘이 되지 않고 프리렌더에도 영향이 없다.
  - #238 worklog 의 「자동으로 넘어가게 하지는 않았다」도 이번 요청으로 바뀌었다.
- **일시정지 버튼을 넣었다.** WCAG 2.2.2 는 5초 넘게 저절로 움직이는 콘텐츠에 멈출 수단을 요구한다.
  마우스를 올렸을 때만 멈추는 방식은 터치 사용자에게 수단이 되지 못한다.
- **사용자가 정한 것:**
  - AI 크롤러는 전부 허용한다.
  - 접근 기록은 켜고, 처리방침도 같은 PR 에서 고친다.
  - 홈 제목은 브랜드를 앞에 둔다. 「탭만 PreeT」 안은 구글이 JS 실행 뒤 제목을 쓰므로 키워드 효과가 사라져서 뺐다.
  - 알약은 번호를 왼쪽에 둔다.

## 확인

- `tsc` 오류 0, `npm test` 190개 통과, `npm run lint` 오류 0(경고 10건은 기존 것), `check:tokens` 일치
- 빌드: 목업 빌드와 `VITE_API=http` 빌드 모두 통과. 프리렌더 h1 1, 본문 1588 / 2178 / 1012 / 1801자
- 로컬 Caddy 2.11.8
  - 실제 `deploy/Caddyfile` 이 `adapt --validate` 를 통과했다.
  - 사이트 주소·root·로그 경로만 바꾼 사본으로 다음을 확인했다.
    - 라우팅: 공개 4페이지는 각 파일, 나머지는 noindex 틀
    - 응답 헤더: 크롤러 파일의 MIME, zstd 압축, immutable 캐시, HSTS
    - 접근 기록: IP 가 가려지고(`127.0.0.1` → `127.0.0.0`, `::1` → `::`), Cookie·Authorization 이 REDACTED 로 남고, API 요청은 기록되지 않음
  - GPTBot·ClaudeBot·PerplexityBot·Yeti·Googlebot 등 6개 UA 모두 h1 이 든 본문을 받았다.
- 헤드리스 Chrome
  - 인트로: 첫 방문은 덮개 → 인트로 → 랜딩 순서로 본문이 번쩍이지 않는다. 재방문하면 인트로가 없다.
  - 콘솔 0건, 탭 제목 정상, 375px 넘침 없음
  - 히어로: CDP 로 프레임마다 장면 위치를 기록했다.
    - 3→1, 1→3 에서 2번 장면이 보인 프레임 0개. 제자리로 돌리는 순간에도 화면이 튀지 않는다.
    - 일시정지·마우스·키보드 포커스·인트로·움직임 줄이기 경우 모두 기대대로 동작했다.

## 남은 것 · 아는 문제

- 운영 서버에서는 아직 확인하지 못했다.
  - 배포 직후 13절 curl 명령을 돌리고, 카카오 공유 디버거로 미리보기 캐시를 지운다.
  - 서버에서 크롤러 집계 명령(`zcat`)을 돌려 보지 않았다.
- 배포일 + 14일에 Phase 0 를 다시 재고 접근 기록에서 크롤러 방문 수를 센다.
- 2번 묶음: 서치콘솔(DuckDNS TXT 로 소유 확인 가능)·서치어드바이저·Bing 등록과 사이트맵 제출. 팀 계정이 필요하다.
  네이버 소유 확인 태그는 `index.html` 에 넣어 배포해야 한다.
- 3번 묶음: JSON-LD(검수 불필요), 질문별 공개 페이지(세무 검수 필요). 룰카드 45개 중 44개가 `미검수` 다.
- 4번 묶음: README 서비스 소개, 저장소 설명, 문의 메일 `Preet.noreply@gmail.com` 정리
- 아는 문제
  - 없는 주소는 noindex 를 달고 여전히 200 으로 나간다.
  - 약관 description 이 18자로 짧다.
  - 폰트 `@import` 체인은 그대로다.
  - Core Web Vitals 는 재지 못했다(PSI API 429).
- #238 의 랜딩 문구 「검수를 마친 규칙 카드 53장」이 룰카드 실제 상태와 맞지 않는다. 메타와 llms.txt 에는 옮기지 않았다. 팀 확인이 필요하다.
- 열린 #242 와 `HeroBanner.tsx` 한 곳이 충돌한다. 알약 `<div>` 줄(#242 의 `text-white`) 바로 아래에 번호 줄이 들어갔기 때문이다.
  `<div>` 줄은 #242 것을, 아래 번호 줄은 이쪽 것을 남기면 된다.
- `preet-brand/`(브랜드 원본 폴더)는 커밋하지 않았다.

## 13:43 네이버 소유 확인 태그와 검색 도구 등록 정리

- 브랜치: feature/naver-site-verification (develop `82fdcd7` 에서 땄다. feature/seo 는 #244 로 머지됐다)
- 커밋: 26d74d3..47bde5a (2개)

### 한 일

- 2번 묶음의 검색 도구 등록을 사용자가 진행했다.
  - 구글 서치콘솔: 도메인 속성. DuckDNS TXT 로 소유 확인을 마쳤다. 사이트맵을 제출했지만 첫 화면은 「사이트맵을 읽을 수 없음」이었다.
    운영 서버를 Googlebot UA 로 받아 보면 200, `text/xml`, BOM 없는 XML, URL 4개다. 새 속성에서 제출 직후 흔히 뜨는 표시로 보고 기다리기로 했다.
  - Bing 웹마스터 도구: 서치콘솔에서 가져와 등록했다.
  - 네이버 서치어드바이저: HTML 태그 방식을 골랐다. 확인은 이 PR 이 배포된 뒤에 누른다.
- `frontend/index.html` 에 `naver-site-verification` 메타 태그를 넣었다. 프리렌더가 이 파일을 틀로 쓰므로 공개 4페이지와 `app.html` 에 모두 들어간다.
- `docs/deployment.md` 13절에 「검색 도구 등록」을 더했다. 도구마다 소유 확인 값이 어디 있는지, 무엇을 지우면 확인이 풀리는지 적었다.

### 왜 이렇게 했나

- 네이버는 DNS 확인 방식이 없어 HTML 태그나 HTML 파일 중 하나다. 태그는 `index.html` 한 줄이라 빌드 과정을 건드리지 않는다.
- DuckDNS 는 도메인마다 TXT 를 하나만 둔다. 누가 다른 용도로 TXT 를 갱신하면 서치콘솔과 그에 딸린 Bing 확인이 함께 풀린다. 이 점을 문서에 남겼다.

### 확인

- `npm run build` 통과. 프리렌더 h1 1, 본문 1583 / 2173 / 1007 / 1796자
- `dist/` 의 `index/faq/terms/privacy/app.html` 다섯 파일 모두에 태그가 1개씩 있다.

### 남은 것

- 배포 뒤 서치어드바이저에서 소유확인을 누르고, 사이트맵 제출과 웹 페이지 수집 요청(`/`, `/faq`)을 한다.
- 서치콘솔 사이트맵이 2~3일 뒤에도 「읽을 수 없음」이면 접근 기록에서 Googlebot 의 `sitemap.xml` 요청을 찾아본다.
- 다음 배포 PR 에는 아직 release 에 없는 #241·#242(브랜드 에셋, 접근성·Really·팔레트)도 함께 실린다.
