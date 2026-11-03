import { useEffect } from 'react';

const BRAND = 'PreeT';

/** 브라우저 탭 이름. 「판정 결과 · PreeT」. 화면을 떠나면 서비스 이름으로 돌려 둔다 */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · ${BRAND}` : BRAND;
    return () => {
      document.title = BRAND;
    };
  }, [title]);
}
