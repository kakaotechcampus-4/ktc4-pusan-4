import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { JudgmentRow } from '../components/results/JudgmentRow';
import { JudgmentDetailPanel } from '../components/results/JudgmentDetailPanel';
import { useSession } from '../contexts/SessionContext';
import { BATCH_SUMMARY } from '../mock/judgments';
import type { Verdict } from '../types/domain';
import { formatNumber, formatWon } from '../utils/format';
type Tab = 'ALL' | Verdict;
export function Results() {
  const {
    judgments,
    counts,
    overrides,
    overrideJudgment,
    pendingQuestionCount,
    recognizedAmount
  } = useSession();
  const [tab, setTab] = useState<Tab>('ALL');
  const [selectedId, setSelectedId] = useState(judgments[0]?.id ?? '');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const tabs: {
    key: Tab;
    label: string;
    count: number;
    tone: string;
  }[] = [{
    key: 'ALL',
    label: '전체',
    count: counts.possible + counts.needsReview + counts.impossible,
    tone: 'text-ink'
  }, {
    key: 'POSSIBLE',
    label: '가능',
    count: counts.possible,
    tone: 'text-ok'
  }, {
    key: 'NEEDS_REVIEW',
    label: '확인 필요',
    count: counts.needsReview,
    tone: 'text-warn'
  }, {
    key: 'IMPOSSIBLE',
    label: '불가',
    count: counts.impossible,
    tone: 'text-deny'
  }];
  const visible = useMemo(() => tab === 'ALL' ? judgments : judgments.filter((judgment) => judgment.verdict === tab), [judgments, tab]);
  const selected = judgments.find((judgment) => judgment.id === selectedId) ?? judgments[0];
  return <AppShell>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-accent">4단계 · 반영</p>
          <h1 className="mt-1.5 text-[28px] font-bold tracking-tight text-ink">
            판정 결과
          </h1>
          <p className="mt-2 text-[14px] tabular-nums text-muted">
            2026년 1월 · {formatNumber(BATCH_SUMMARY.total)}건 · 인정 경비{' '}
            <strong className="font-semibold text-ink">
              {formatWon(recognizedAmount)}
            </strong>
          </p>
        </div>
        <Link to="/summary" className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors duration-150 ease-snap hover:bg-line2">
          요약 보기
          <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </Link>
      </header>

      {pendingQuestionCount > 0 && <Link to="/questions" className="mt-6 flex items-center gap-3 rounded-2xl border border-warn-line bg-warn-bg px-5 py-4 transition-colors duration-150 ease-snap hover:bg-warn-bg/70">
          <div className="h-5 w-5 shrink-0 text-warn" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-ink">
              질문 {pendingQuestionCount}개에 답하면 확인 필요{' '}
              {formatNumber(counts.needsReview)}건이 줄어듭니다
            </span>
            <span className="mt-0.5 block text-[13px] text-ink2">
              같은 사유끼리 묶어 물어봅니다. 한 번 답하면 다음 판정에서 다시 묻지
              않습니다.
            </span>
          </span>
          <ArrowRightIcon className="h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
        </Link>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div role="tablist" aria-label="판정 3분류" className="flex gap-1 border-b border-line px-3 py-2.5">
            {tabs.map((item) => {
            const active = tab === item.key;
            return <button key={item.key} role="tab" aria-selected={active} type="button" onClick={() => setTab(item.key)} className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors duration-150 ease-snap ${active ? 'bg-ink text-white' : `${item.tone} hover:bg-canvas`}`}>
                  {item.label}
                  <span className="ml-1.5 tabular-nums opacity-70">
                    {formatNumber(item.count)}
                  </span>
                </button>;
          })}
          </div>

          {visible.length > 0 ? <ul className="divide-y divide-line2">
              {visible.map((judgment) => <JudgmentRow key={judgment.id} judgment={judgment} selected={judgment.id === selected?.id} expanded={expandedId === judgment.id} onSelect={() => setSelectedId(judgment.id)} onToggle={() => setExpandedId((prev) => prev === judgment.id ? null : judgment.id)} />)}
            </ul> : <div className="px-6 py-16 text-center">
              <p className="text-[14px] font-semibold text-ink">
                이 분류에 남은 건이 없습니다
              </p>
              <p className="mt-1 text-[13px] text-muted">
                답변으로 모두 정리되었습니다.
              </p>
            </div>}

          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[12px] tabular-nums text-muted">
            <span>
              1–{visible.length} / {formatNumber(BATCH_SUMMARY.total)}건
            </span>
            <div className="flex gap-1">
              <button type="button" disabled className="rounded-lg border border-line px-2.5 py-1 text-muted disabled:opacity-50">
                이전
              </button>
              <button type="button" className="rounded-lg border border-line px-2.5 py-1 text-ink transition-colors duration-150 hover:bg-canvas">
                다음
              </button>
            </div>
          </div>
        </section>

        {selected && <aside className="lg:sticky lg:top-32 lg:self-start">
            <JudgmentDetailPanel judgment={selected} overridden={Boolean(overrides[selected.id])} onOverride={(verdict) => overrideJudgment(selected.id, verdict)} />
          </aside>}
      </div>
    </AppShell>;
}