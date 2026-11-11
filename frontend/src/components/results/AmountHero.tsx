import type { ReactNode } from 'react';
import { Badge, cn } from '../ui';
import { formatNumber, formatWon } from '../../utils/format';
import { AWAITING_ANSWER, VERDICT_LABEL, VERDICT_META } from '../../utils/verdict';
import { SHARE_BAR, type Share, type ShareKey } from '../../utils/shares';

/** 「판정한 결제 1,234,000원 중 18%」. 0 보다 크지만 1% 가 안 되면 0% 로 읽히지 않게 한다 */
const shareText = (amount: number, spend: number) => {
  const percent = amount / spend * 100;
  return percent > 0 && percent < 1 ? '1% 미만' : `${Math.round(percent)}%`;
};

const shareBadge = (key: ShareKey) =>
key === 'AWAITING' ?
<Badge>{AWAITING_ANSWER}</Badge> :
<Badge tone={VERDICT_META[key].tone} symbol={VERDICT_META[key].symbol}>
      {VERDICT_LABEL[key]}
    </Badge>;


/**
 * 결과와 요약 머리의 판. 왼쪽은 화면에서 가장 먼저 읽을 경비 가능 금액, 오른쪽은 판정한 결제가
 * 판정별로 어떻게 갈렸는지다. 이 판 하나만 surface 로 칠해 화면의 중심을 잡는다(DESIGN.md 회색 규칙의 예외).
 * counts 를 끄면 건수 없이 금액만 보인다(결과는 아래 필터가 건수를 센다)
 */
export function AmountHero({
  amount,
  spend,
  shares,
  counts = true,
  label = '경비 가능 금액',
  children,
  className
}: {amount: number;spend: number | null;shares?: Share[] | null;counts?: boolean;label?: string;children?: ReactNode;className?: string;}) {
  const visible = shares?.filter((share) => share.count > 0) ?? [];
  /** 막대는 금액으로 나눈다. 금액을 못 읽었으면 건수로 나눈다 */
  const byAmount = visible.every((share) => share.amount !== null);
  const value = (share: Share) => byAmount ? share.amount ?? 0 : share.count;
  const total = visible.reduce((sum, share) => sum + value(share), 0);
  return (
    <section aria-label={label} className={cn('rounded-2xl bg-surface p-6 sm:p-8', className)}>
      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
        <div className="min-w-0">
          <p className="text-small text-ink2">{label}</p>
          <p className="mt-2 text-h1 font-bold tabular-nums text-ink lg:text-h1-lg">{formatWon(amount)}</p>
          {spend !== null && spend > 0 &&
          <p className="mt-1 text-small tabular-nums text-ink2">
              판정한 결제 {formatWon(spend)} 중 <b className="text-ink">{shareText(amount, spend)}</b>
            </p>
          }
          {children && <div className="mt-6 space-y-2 text-small text-ink2">{children}</div>}
        </div>

        {shares !== undefined &&
        <div className="min-w-0 self-center">
            {/* 판정별 몫. 아래 목록이 같은 순서로 금액을 적는다 */}
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
              {total > 0 &&
            visible.map((share) =>
            <span key={share.key} className={SHARE_BAR[share.key]} style={{ flex: `${value(share)} 1 0` }} />
            )}
            </div>
            {shares === null ?
          <span className="mt-5 block h-24 animate-pulse rounded-xl bg-line" /> :

          <dl className="mt-4 divide-y divide-line">
                {visible.map((share) =>
            <div key={share.key} className="flex items-center gap-3 py-3">
                    <dt className="min-w-0 flex-1">{shareBadge(share.key)}</dt>
                    {counts &&
              <dd className="whitespace-nowrap text-small tabular-nums text-ink2">{formatNumber(share.count)}건</dd>
              }
                    <dd className="w-32 whitespace-nowrap text-right text-body font-bold tabular-nums text-ink">
                      {share.amount === null ? '-' : formatWon(share.amount)}
                    </dd>
                  </div>
            )}
              </dl>
          }
          </div>
        }
      </div>
    </section>);

}
