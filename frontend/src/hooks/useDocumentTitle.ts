import { useEffect } from 'react';

const BRAND = 'PreeT';

/**
 * 「판정 결과 · PreeT」. 제목이 없으면 서비스 이름만, 이미 PreeT 로 시작하면(홈, seo.ts) 그대로.
 * 프리렌더(scripts/prerender.mjs)도 이 꼴을 쓴다
 */
export const documentTitle = (title: string | null | undefined) =>
  !title ? BRAND : title.startsWith(BRAND) ? title : `${title} · ${BRAND}`;

/** 브라우저 탭 이름. 화면을 떠나면 서비스 이름으로 돌려 둔다 */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = documentTitle(title);
    return () => {
      document.title = BRAND;
    };
  }, [title]);
}
