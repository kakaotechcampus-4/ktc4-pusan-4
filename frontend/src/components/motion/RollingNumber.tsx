import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/** 숫자가 굴러가는 시간. 마지막에 천천히 멈추는 곡선을 쓴다 */
const DURATION = 900;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * 값이 바뀌면 앞 값에서 새 값까지 숫자가 굴러간다. 답하거나 고쳐 금액이 바뀐 것이 눈에 보이게 한다.
 * 처음 그릴 때는 굴리지 않고 바로 보인다. fromZero 를 주면 처음에도 0 에서 굴러 올라간다(화면의 첫 숫자 하나에만).
 * 1초 안에 최종값에 멈춘다. 글자를 둘로 나누면 복사할 때 금액이 두 번 붙어서 하나로 둔다
 */
export function RollingNumber({
  value,
  format,
  fromZero = false,
  className
}: {value: number;format: (value: number) => string;fromZero?: boolean;className?: string;}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(fromZero && !reduced ? 0 : value);
  const current = useRef(shown);
  current.current = shown;

  useEffect(() => {
    if (reduced) {
      setShown(value);
      return;
    }
    const from = current.current;
    if (from === value) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      setShown(t >= 1 ? value : Math.round(from + (value - from) * easeOut(t)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);

  return <span className={className}>{format(shown)}</span>;

}
