import React from 'react';
import { FileTextIcon, RouteIcon, TriangleAlertIcon } from 'lucide-react';
import type { Judgment, Verdict } from '../../types/domain';
import { VerdictBadge } from '../VerdictBadge';
import { StatuteCitation } from '../StatuteCitation';
import { formatFullDate, formatWon } from '../../utils/format';
import { BATCH_SUMMARY } from '../../mock/judgments';

interface JudgmentDetailPanelProps {
  judgment: Judgment;
  overridden: boolean;
  onOverride: (verdict: Verdict) => void;
}

export function JudgmentDetailPanel({
  judgment,
  overridden,
  onOverride
}: JudgmentDetailPanelProps) {
  const { transaction } = judgment;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="border-b border-line px-5 py-4">
        <VerdictBadge verdict={judgment.verdict} size="md" />
        <h2 className="mt-2.5 text-[17px] font-bold tracking-tight text-ink">
          {transaction.merchantNorm}
        </h2>
        <p className="mt-1 text-[12px] tabular-nums text-muted">
          {formatFullDate(transaction.transactedAt)} · {transaction.merchantRaw}
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
            judgment.finalAmount > 0 ? 'text-ok' : 'text-muted'}`
            }>
            
            {formatWon(judgment.finalAmount)}
          </dd>
        </div>
      </dl>

      <section className="border-b border-line px-5 py-4">
        <h3 className="text-[13px] font-semibold text-ink">판정 이유</h3>
        <p className="mt-2 text-[13px] leading-6 text-ink2">{judgment.reason}</p>
      </section>

      <section className="border-b border-line px-5 py-4">
        <h3 className="text-[13px] font-semibold text-ink">근거 조문</h3>
        {judgment.citations.length > 0 ?
        <div className="mt-2.5 space-y-2">
            {judgment.citations.map((statuteId) =>
          <StatuteCitation key={statuteId} statuteId={statuteId} />
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

      {judgment.documents.length > 0 &&
      <section className="border-b border-line px-5 py-4">
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            <FileTextIcon className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            준비할 증빙
          </h3>
          <ul className="mt-2 space-y-1">
            {judgment.documents.map((document) =>
          <li
            key={document}
            className="text-[13px] leading-6 text-ink2 before:mr-1.5 before:text-muted before:content-['·']">
            
                {document}
              </li>
          )}
          </ul>
        </section>
      }

      <section className="border-b border-line px-5 py-4">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <RouteIcon className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
          거쳐온 게이트
        </h3>
        <ol className="mt-2.5 space-y-2">
          {judgment.gateTrace.map((step, index) =>
          <li key={`${step.gate}-${index}`} className="flex gap-2.5">
              <span className="w-6 shrink-0 text-[12px] font-semibold tabular-nums text-muted">
                {step.gate}
              </span>
              <span className="text-[13px] leading-5 text-ink2">
                {step.result}
              </span>
            </li>
          )}
        </ol>
      </section>

      <section className="border-b border-line bg-canvas px-5 py-3.5">
        <dl className="space-y-1 text-[12px] tabular-nums text-muted">
          <div className="flex justify-between gap-2">
            <dt>규칙 카드</dt>
            <dd className="text-ink2">{judgment.ruleCardId}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>규칙 커밋</dt>
            <dd className="text-ink2">{BATCH_SUMMARY.rulesCommitSha}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>문진 버전</dt>
            <dd className="text-ink2">v{BATCH_SUMMARY.contextVersion}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>귀속연도</dt>
            <dd className="text-ink2">{BATCH_SUMMARY.taxYear}</dd>
          </div>
        </dl>
      </section>

      <section className="px-5 py-4">
        <h3 className="text-[13px] font-semibold text-ink">
          판정이 실제와 다르다면
        </h3>
        <p className="mt-1.5 text-[12px] leading-5 text-muted">
          바꾼 기록은 규칙 개선 신호로만 쌓이고, 다른 사용자에게 전파되지 않습니다.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onOverride('POSSIBLE')}
            className="flex-1 rounded-lg border border-line px-3 py-2 text-[13px] font-semibold text-ink transition-colors duration-150 ease-snap hover:bg-ok-bg hover:text-ok">
            
            가능으로 표시
          </button>
          <button
            type="button"
            onClick={() => onOverride('IMPOSSIBLE')}
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