import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * 화면이 바뀌면 맨 위로 올린다.
 *
 * 라우터는 스크롤을 건드리지 않는다. 그래서 랜딩 맨 아래 꼬리말에서 「이용약관」을 누르면
 * /terms 로 가고도 그 높이(1133px)에 그대로 서 있어 약관 끝부터 보였다 (#242 리뷰).
 *
 * 뒤로·앞으로(POP)는 두고 본다. 읽던 자리로 돌아가는 게 맞고 브라우저가 알아서 복원한다.
 * 주소의 검색 조건만 바뀌는 경우도 두고 본다 — 목록에서 쪽을 넘기면 보던 자리를 잃는다.
 *
 * 프리렌더(entry-server.tsx)는 renderToString 이라 effect 가 돌지 않는다. 그대로 둬도 된다
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;
    window.scrollTo(0, 0);
  }, [pathname, navigationType]);

  return null;
}
