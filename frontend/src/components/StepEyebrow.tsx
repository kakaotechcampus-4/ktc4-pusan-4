import { useLocation } from 'react-router-dom';
import { stepIndex } from './steps';

/**
 * 화면 맨 위의 「N단계 이름」.
 *
 * 번호는 주소에서 꺼내고 이름은 화면이 준다 — 같은 단계라도 화면 이름은 다르다
 * (3단계는 「판정 전 확인」과 「판정」, 4단계는 「결과」·「질문」·「요약」).
 * 단계가 아닌 화면은 번호 없이 넘긴 이름만 적는다 (문진의 「설정 사업자 문진」).
 * 번호와 이름 사이는 가운뎃점 대신 띄운다 (11/5 치오 방향)
 */
export function StepEyebrow({
  children,
  prefix



}: {children: React.ReactNode;prefix?: string;}) {
  const { pathname } = useLocation();
  const index = stepIndex(pathname);
  const head = prefix ?? (index >= 0 ? `${index + 1}단계` : null);
  return (
    <p className="flex flex-wrap gap-x-2 text-small font-bold text-accent">
      {head && <span>{head}</span>}
      <span>{children}</span>
    </p>);

}
