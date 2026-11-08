import { useLocation } from 'react-router-dom';
import { stepIndex } from './steps';

/**
 * 화면 맨 위의 「N단계」. 번호는 주소에서 꺼낸다.
 * 화면 이름은 바로 아래 h1 과 머리말 경로에 이미 있어 여기서 다시 적지 않는다 (11/5 치오 방향).
 * 단계가 아닌 화면에서는 그리지 않는다
 */
export function StepEyebrow() {
  const { pathname } = useLocation();
  const index = stepIndex(pathname);
  if (index < 0) return null;
  return <p className="text-small font-bold text-accent">{index + 1}단계</p>;
}
