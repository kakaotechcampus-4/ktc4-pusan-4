import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';
const canAsk = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

/**
 * 움직임을 줄여야 하는가. 켰으면 숫자는 굴리지 않고, 칸은 차례로 들어오지 않고 바로 놓인다.
 * matchMedia 가 없는 환경(테스트, 프리렌더)은 줄인 것으로 본다. 끝난 모습을 바로 그린다
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => !canAsk() || window.matchMedia(QUERY).matches);
  useEffect(() => {
    if (!canAsk()) return;
    const list = window.matchMedia(QUERY);
    const update = () => setReduced(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, []);
  return reduced;
}
