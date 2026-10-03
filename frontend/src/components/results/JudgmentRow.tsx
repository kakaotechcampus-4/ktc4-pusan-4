import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDownIcon } from 'lucide-react';
import type { Judgment, Transaction } from '../../types/domain';
import { VerdictBadge } from '../VerdictBadge';
import { api, useApi } from '../../api';
import { formatDate, formatWon } from '../../utils/format';

function StatuteChip({ statuteVersionId }: {statuteVersionId: number;}) {
  const { data } = useApi(() => api.statutes.get(statuteVersionId), [statuteVersionId]);
  if (!data) return null;
  return (
    <li className="rounded-md border border-line bg-surface px-2 py-0.5 text-[12px] text-ink">
      {data.title}
    </li>);

}

interface JudgmentRowProps {
  judgment: Judgment;
  transaction: Transaction | undefined;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggle: () => void;
}

export function JudgmentRow({
  judgment,
  transaction,
  selected,
  expanded,
  onSelect,
  onToggle
}: JudgmentRowProps) {
  if (!transaction) return null;

  const ratio = judgment.attributes['안분율'];
  const showFinal =
  judgment.verdict.code === 'AVAILABLE' &&
  judgment.finalAmount !== null &&
  judgment.finalAmount !== transaction.amount;

  return (
    <li
      className={`border-l-2 transition-colors duration-150 ${
      selected ? 'border-accent bg-accent-soft/40' : 'border-transparent'}`
      }>

      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-3 text-left">

          <span className="w-14 shrink-0 text-[12px] tabular-nums text-muted">
            {formatDate(transaction.approvedAt)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium text-ink">
              {transaction.merchantNorm}
            </span>
            <span className="mt-0.5 block truncate text-[12px] text-muted">
              {transaction.merchantRaw} · {transaction.merchantCategory}
              {transaction.installmentMonths > 0 &&
              ` · ${transaction.installmentMonths}개월 할부`}
            </span>
          </span>
          <span className="w-32 shrink-0 text-right">
            <span className="block text-[14px] font-semibold tabular-nums text-ink">
              {formatWon(transaction.amount)}
            </span>
            {showFinal && judgment.finalAmount !== null &&
            <span className="block text-[12px] tabular-nums text-ok">
                산입 {formatWon(judgment.finalAmount)}
                {typeof ratio === 'number' && ` (${ratio}%)`}
              </span>
            }
          </span>
          <span className="w-24 shrink-0 text-right">
            <VerdictBadge verdict={judgment.verdict} />
          </span>
        </button>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${transaction.merchantNorm} 근거 ${expanded ? '접기' : '펼치기'}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors duration-150 hover:bg-line2 hover:text-ink">

          <ChevronDownIcon
            className={`h-4 w-4 transition-transform duration-200 ease-snap ${
            expanded ? 'rotate-180' : ''}`
            }
            aria-hidden="true" />

        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded &&
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="overflow-hidden">

            <div className="space-y-3 px-4 pb-4 pl-[4.75rem]">
              <p className="text-[13px] leading-6 text-ink2">
                {judgment.explanation ?? '적용된 규칙 카드에 설명 문구가 없습니다.'}
              </p>

              {judgment.blockedAtGate &&
            <p className="text-[12px] tabular-nums text-muted">
                  막힌 게이트 {judgment.blockedAtGate}
                  {judgment.unmatchedReason && ` · 사유 ${judgment.unmatchedReason}`}
                </p>
            }

              {judgment.citations.length > 0 ?
            <ul className="flex flex-wrap gap-1.5">
                  {judgment.citations.map((citation) =>
              <StatuteChip
                key={citation.statuteVersionId}
                statuteVersionId={citation.statuteVersionId} />

              )}
                </ul> :

            <p className="inline-flex rounded-md border border-warn-line bg-warn-bg px-2 py-0.5 text-[12px] font-semibold text-warn">
                  근거 조문 없음 · 추론으로 표시된 건
                </p>
            }
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </li>);

}
