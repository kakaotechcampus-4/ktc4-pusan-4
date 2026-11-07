import { cn } from '../ui';
import { formatWon } from '../../utils/format';

/** 「판정한 결제 1,234,000원 중 18%」. 0 보다 크지만 1% 가 안 되면 0% 로 읽히지 않게 한다 */
const shareText = (amount: number, spend: number) => {
  const percent = amount / spend * 100;
  return percent > 0 && percent < 1 ? '1% 미만' : `${Math.round(percent)}%`;
};

/**
 * 결과와 요약 머리의 경비 가능 금액. 화면에서 가장 먼저 읽을 숫자라 크게 쓰고,
 * 판정한 결제 가운데 얼마만큼인지 막대로 보인다. 막대는 판정이 아니라 금액의 몫이라 판정 색을 쓰지 않는다
 */
export function AmountHero({
  amount,
  spend,
  label = '경비 가능 금액',
  className
}: {amount: number;spend: number | null;label?: string;className?: string;}) {
  const share = spend && spend > 0 ? Math.min(1, Math.max(0, amount / spend)) : null;
  return (
    // 폭을 정해 둔다. 결과 머리처럼 내용만큼 줄어드는 자리에서도 요약과 같은 길이의 막대가 된다
    <div className={cn('w-[28rem] max-w-full', className)}>
      <p className="text-small text-ink2">{label}</p>
      <p className="mt-1 text-stat font-bold tabular-nums text-ink">{formatWon(amount)}</p>
      {share !== null && spend !== null &&
      <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-line2" aria-hidden="true">
            <div className="h-full rounded-full bg-ink" style={{ width: `${share * 100}%` }} />
          </div>
          <p className="mt-2 whitespace-nowrap text-small tabular-nums text-ink2">
            판정한 결제 {formatWon(spend)} 중 {shareText(amount, spend)}
          </p>
        </div>
      }
    </div>);

}
