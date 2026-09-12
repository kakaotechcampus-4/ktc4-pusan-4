import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDownIcon } from 'lucide-react';
import type { Judgment } from '../../types/domain';
import { VerdictBadge } from '../VerdictBadge';
import { statuteOf } from '../../mock/statutes';
import { REASON_LABEL } from '../../utils/verdict';
import { formatDate, formatWon } from '../../utils/format';

interface JudgmentRowProps {
  judgment: Judgment;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggle: () => void;
}

export function JudgmentRow({
  judgment,
  selected,
  expanded,
  onSelect,
  onToggle
}: JudgmentRowProps) {
  const { transaction } = judgment;
  const showFinal =
  judgment.verdict === 'POSSIBLE' &&
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
            {formatDate(transaction.transactedAt)}
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
            {showFinal &&
            <span className="block text-[12px] tabular-nums text-ok">
                산입 {formatWon(judgment.finalAmount)}
                {judgment.ratio !== null && ` (${judgment.ratio}%)`}
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
              <p className="text-[13px] leading-6 text-ink2">{judgment.reason}</p>

              {judgment.blockedAtGate &&
            <p className="text-[12px] tabular-nums text-muted">
                  막힌 게이트 {judgment.blockedAtGate}
                  {judgment.reasonCode &&
              ` · 사유 ${REASON_LABEL[judgment.reasonCode]}`}
                </p>
            }

              {judgment.citations.length > 0 ?
            <ul className="flex flex-wrap gap-1.5">
                  {judgment.citations.map((statuteId) => {
                const statute = statuteOf(statuteId);
                if (!statute) return null;
                const isEvidence = statute.role === 'EVIDENCE';
                return (
                  <li
                    key={statuteId}
                    className={`rounded-md border px-2 py-0.5 text-[12px] ${
                    isEvidence ?
                    'border-line bg-surface text-ink' :
                    'border-dashed border-line bg-canvas text-muted'}`
                    }>
                    
                        {statute.label}
                        {!isEvidence && ' (참고)'}
                      </li>);

              })}
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