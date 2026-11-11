import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { cn } from '../ui';

const STROKE = {
  edge: 'stroke-edge',
  accent: 'stroke-accent',
  deny: 'stroke-deny'
} as const;

/**
 * 놓을 칸의 점선 테두리. moving 이면 점선이 테를 따라 흐른다(파일을 끌어 올렸을 때, 읽는 동안).
 * CSS 점선은 움직일 수 없어 SVG 로 그린다. SVG 를 1px 안쪽에 두고 2px 선을 그려 선이 부모의 바깥 2px 에 놓인다.
 * 둥근 모서리에서 점선이 반쯤 걸려도 끝이 둥글어 갈고리처럼 보이지 않는다.
 * 움직임 줄이기를 켰으면 색만 바뀐다. 부모는 relative 에 rounded-2xl(16px) 이어야 한다
 */
export function LiveBorder({ tone, moving = false }: {tone: keyof typeof STROKE;moving?: boolean;}) {
  const rect = useRef<SVGRectElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const element = rect.current;
    if (!moving || reduced || !element || typeof element.animate !== 'function') return;
    const flow = element.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: -16 }], { duration: 700, iterations: Infinity });
    return () => flow.cancel();
  }, [moving, reduced]);

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute left-px top-px h-[calc(100%-2px)] w-[calc(100%-2px)] overflow-visible">

      <rect
        ref={rect}
        width="100%"
        height="100%"
        rx="15"
        ry="15"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="7 9"
        className={cn('transition-[stroke] duration-200 ease-motion', STROKE[tone])} />
    </svg>);

}
