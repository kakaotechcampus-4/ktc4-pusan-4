import { Card, Empty } from '../ui';
import type { JudgmentSummary } from '../../types/domain';
import { formatNumber, formatWon } from '../../utils/format';

type AccountRow = JudgmentSummary['byAccount'][number];

/**
 * 계정과목별 경비 가능 금액 카드. 요약(업로드 하나)과 연간 결과(한 해)가 같이 쓴다.
 * 계정과목이 없는 경비 가능 금액(예: 사용자가 가능으로 바꾼 거래)도 표에 남겨 합계가 맞게 한다
 */
export function AccountBreakdown({ summary, loading }: {summary: JudgmentSummary | null;loading: boolean;}) {
  const accountRows: AccountRow[] = summary ? [...summary.byAccount] : [];
  if (summary) {
    const listed = summary.byAccount.reduce(
      (sum, row) => ({ count: sum.count + row.count, amount: sum.amount + row.finalAmount }),
      { count: 0, amount: 0 }
    );
    const rest = summary.byVerdict.AVAILABLE.finalAmount - listed.amount;
    if (rest > 0)
    accountRows.push({
      account: '계정과목 미지정',
      accountLabel: '계정과목 미지정',
      count: Math.max(0, summary.byVerdict.AVAILABLE.count - listed.count),
      finalAmount: rest
    });
  }
  accountRows.sort((a, b) => b.finalAmount - a.finalAmount);
  const accountTotal = accountRows.reduce((sum, row) => sum + row.finalAmount, 0);

  return (
    <Card as="section" padding="sm">
        <h2 className="text-body-lg font-bold text-ink">계정과목별 경비 가능 금액</h2>
        {loading && !summary ?
      <span className="mt-5 block h-24 animate-pulse rounded bg-line2" /> :
      accountRows.length === 0 ?
      <Empty className="mt-4" inTable title="가능으로 판정한 거래가 아직 없습니다" /> :

      <ul aria-label="계정과목별 경비 가능 금액" className="mt-5 space-y-5">
            {accountRows.map((row) => {
          /** 경비 가능 금액 가운데 이 계정과목의 몫. 막대도 같은 몫만큼 찬다 */
          const share = accountTotal > 0 ? row.finalAmount / accountTotal : 0;
          return (
            <li key={row.account}>
                  <div className="flex items-baseline gap-3">
                    <span className="min-w-0 flex-1 truncate text-body text-ink">{row.accountLabel}</span>
                    <span className="whitespace-nowrap text-small tabular-nums text-ink2">
                      {formatNumber(row.count)}건
                    </span>
                    <span className="w-28 whitespace-nowrap text-right text-body font-bold tabular-nums text-ink">
                      {formatWon(row.finalAmount)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <span aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                      <span className="block h-full rounded-full bg-ink" style={{ width: `${share * 100}%` }} />
                    </span>
                    <span className="w-10 text-right text-caption tabular-nums text-ink2">
                      {Math.round(share * 100)}%
                    </span>
                  </div>
                </li>);

        })}
          </ul>
      }
      </Card>);

}
