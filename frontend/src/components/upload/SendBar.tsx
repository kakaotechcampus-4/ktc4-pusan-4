import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/**
 * 올리는 동안의 진행 띠. 서버는 한 요청 안에서 저장과 분류를 마치고 답해 남은 몫을 알 수 없다.
 * 그래서 차오르는 막대 대신 짧은 띠가 왼쪽에서 오른쪽으로 지나가며 멈추지 않았다는 것만 보인다.
 * 움직임 줄이기를 켰으면 그리지 않는다(옆의 지난 초가 같은 일을 한다)
 */
export function SendBar() {
  const reduced = useReducedMotion();
  const bar = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = bar.current;
    if (reduced || !element || typeof element.animate !== 'function') return;
    const sweep = element.animate(
      [{ transform: 'translateX(-100%)' }, { transform: 'translateX(350%)' }],
      { duration: 1400, iterations: Infinity, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' }
    );
    return () => sweep.cancel();
  }, [reduced]);

  if (reduced) return null;
  return (
    <span aria-hidden="true" className="relative mt-4 block h-1.5 overflow-hidden rounded-full bg-line">
      <span ref={bar} className="absolute inset-y-0 left-0 w-1/4 rounded-full bg-accent" />
    </span>);

}
