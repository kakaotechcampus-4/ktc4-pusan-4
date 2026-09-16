import React from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import type { Judgment, Transaction, Verdict } from '../../types/domain';
import { VerdictBadge } from '../VerdictBadge';
import { StatuteCitation } from '../StatuteCitation';
import { formatFullDate, formatWon } from '../../utils/format';

interface JudgmentDetailPanelProps {
  judgment: Judgment;
  transaction: Transaction | undefined;
  overridden: boolean;
  onOverride: (verdict: Verdict) => void;
}

export function JudgmentDetailPanel({
  judgment,
  transaction,
  overridden,
  onOverride
}: JudgmentDetailPanelProps) {
  if (!transaction) return null;

  const attributes = Object.entries(judgment.attributes);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="border-b border-line px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <VerdictBadge verdict={judgment.verdict} size="md" />
          <span className="rounded-md border border-line px-1.5 py-0.5 text-[11px] text-muted">
            {judgment.state.label}
          </span>
          <span className="text-[11px] tabular-nums text-muted">
            rev.{judgment.revision}
          </span>
        </div>
        <h2 className="mt-2.5 text-[17px] font-bold tracking-tight text-ink">
          {transaction.merchantNorm}
        </h2>
        <p className="mt-1 text-[12px] tabular-nums text-muted">
          {formatFullDate(transaction.approvedAt)} · {transaction.merchantRaw}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-px border-b border-line bg-line">
        <div className="bg-surface px-5 py-3">
          <dt className="text-[12px] text-muted">승인금액</dt>
          <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink">
            {formatWon(transaction.amount)}
          </dd>
        </div>
        <div className="bg-surface px-5 py-3">
          <dt className="text-[12px] text-muted">필요경비 산입액</dt>
          <dd
            className={`mt-0.5 text-[15px] font-semibold tabular-nums ${
            judgment.finalAmount ? 'text-ok' : 'text-muted'}`
            }>

            {judgment.finalAmount !== null ? formatWon(judgment.finalAmount) : '—'}
          </dd>
        </div>
      </dl>

      <section className="border-b border-line px-5 py-4">
        <h3 className="text-[13px] font-semibold text-ink">판정 이유</h3>
        <p className="mt-2 text-[13px] leading-6 text-ink2">
          {judgment.explanation ??
          '적용된 규칙 카드에 설명 문구가 없습니다. 근거 조문을 확인해 주세요.'}
        </p>
        {judgment.blockedAtGate &&
        <p className="mt-2 text-[12px] tabular-nums text-muted">
            막힌 게이트 {judgment.blockedAtGate}
            {judgment.unmatchedReason && ` · 사유 ${judgment.unmatchedReason}`}
          </p>
        }
      </section>

      <section className="border-b border-line px-5 py-4">
        <h3 className="text-[13px] font-semibold text-ink">근거 조문</h3>
        {judgment.citations.length > 0 ?
        <div className="mt-2.5 space-y-2">
            {judgment.citations.map((citation) =>
          <StatuteCitation
            key={citation.statuteVersionId}
            statuteVersionId={citation.statuteVersionId} />

          )}
          </div> :

        <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-warn-line bg-warn-bg p-3.5">
            <TriangleAlertIcon
            className="mt-0.5 h-4 w-4 shrink-0 text-warn"
            aria-hidden="true" />

            <p className="text-[13px] leading-6 text-ink2">
              <strong className="font-semibold text-warn">근거 조문 없음.</strong>{' '}
              조문을 붙일 수 없어 가능·불가로 확정하지 않았습니다. 확인 필요 상태로만
              유지됩니다.
            </p>
          </div>
        }
      </section>

      <section className="border-b border-line bg-canvas px-5 py-3.5">
        <dl className="space-y-1 text-[12px] tabular-nums text-muted">
          <div className="flex justify-between gap-2">
            <dt>계정과목</dt>
            <dd className="text-ink2">{judgment.account ?? '—'}</dd>
          </div>
          {attributes.map(([key, value]) =>
          <div key={key} className="flex justify-between gap-2">
              <dt>{key}</dt>
              <dd className="text-ink2">{String(value)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <dt>판정 시각</dt>
            <dd className="text-ink2">{judgment.computedAt.slice(0, 16).replace('T', ' ')}</dd>
          </div>
        </dl>
      </section>

      <section className="px-5 py-4">
        <h3 className="text-[13px] font-semibold text-ink">
          판정이 실제와 다르다면
        </h3>
        <p className="mt-1.5 text-[12px] leading-5 text-muted">
          바꾼 기록은 새 Revision으로 남고, 이전 판정은 지워지지 않습니다.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onOverride('AVAILABLE')}
            className="flex-1 rounded-lg border border-line px-3 py-2 text-[13px] font-semibold text-ink transition-colors duration-150 ease-snap hover:bg-ok-bg hover:text-ok">

            가능으로 표시
          </button>
          <button
            type="button"
            onClick={() => onOverride('UNAVAILABLE')}
            className="flex-1 rounded-lg border border-line px-3 py-2 text-[13px] font-semibold text-ink transition-colors duration-150 ease-snap hover:bg-deny-bg hover:text-deny">

            불가로 표시
          </button>
        </div>
        {overridden &&
        <p className="mt-2.5 text-[12px] text-muted">
            사용자 수정으로 기록했습니다. 원래 판정 이력은 그대로 남습니다.
          </p>
        }
      </section>
    </div>);

}
