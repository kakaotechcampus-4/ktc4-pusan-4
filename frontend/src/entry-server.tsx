/* eslint-disable react-refresh/only-export-components -- 빌드 스크립트만 읽는 파일이라 브라우저 HMR 대상이 아니다 */
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { SessionProvider } from './contexts/SessionContext';
import { AppRoutes } from './App';

/**
 * 빌드 때만 쓰는 서버 렌더 입구. scripts/prerender.mjs 가 공개 페이지(seo.ts)를 HTML 로 굳힌다.
 * 크롤러·카카오톡 미리보기는 자바스크립트를 돌리지 않거나 덜 돌려서, 빈 #root 만 받으면 아무것도 못 본다.
 *
 * 세션은 「이어 가는 중」(restoring) 으로 그려진다 — 브라우저 첫 화면과 같다.
 * 브라우저에서는 hydrate 하지 않고 createRoot 가 이 마크업을 지우고 다시 그린다(index.tsx 그대로)
 */
export function render(url: string) {
  return renderToString(
    <SessionProvider>
      <StaticRouter location={url}>
        <AppRoutes />
      </StaticRouter>
    </SessionProvider>
  );
}

export { PAGES, SITE_URL, TAGLINE } from './seo';
export { documentTitle } from './hooks/useDocumentTitle';
export { NOT_DOING } from './mock/marketing';
