import { Link } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { formatNumber } from '../../utils/format';
import { cn } from '../ui';

/**
 * 분류하지 않아 판정에서 빠진 거래. 판정 전 확인, 결과, 요약이 같은 문장과 같은 링크를 쓴다.
 * judged 는 판정을 마친 뒤(결과, 요약)다
 */
export function UnclassifiedNote({ count, judged, className }: {count: number;judged: boolean;className?: string;}) {
  return (
    <p className={cn('flex flex-wrap items-center gap-x-2', className)}>
      {judged ?
      `분류하지 않은 거래 ${formatNumber(count)}건은 아직 판정하지 않았습니다.` :
      `분류하지 않은 거래 ${formatNumber(count)}건은 판정하지 않습니다.`}
      <Link
        to="/preview"
        className="inline-flex items-center gap-1 whitespace-nowrap py-1 font-bold text-accent hover:underline">

        분류 확인하기
        <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </p>);

}
