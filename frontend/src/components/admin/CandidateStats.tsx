import { api, useApi } from '../../api';
import { readAll } from '../../api/readAll';
import type { RuleCandidate } from '../../types/domain';
import { formatNumber } from '../../utils/format';
import { categoryLabel } from '../results/display';
import { Button } from '../ui';
import { candidateStats, type Bar } from './statsOf';

/** 막대 목록. 한 갈래의 수라 accent 하나로 칠하고 범례를 두지 않는다. 값은 막대 오른쪽에 쓴다 */
function BarList({ bars, unit }: {bars: Bar[];unit: string;}) {
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  return (
    <ul className="space-y-2.5">
      {bars.map((bar) =>
      <li key={bar.key} title={bar.title} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto] items-center gap-3 text-small">
          <span className="truncate text-ink">{bar.label}</span>
          <span className="h-2 rounded-r-[4px] bg-line2" aria-hidden="true">
            <span className="block h-2 rounded-r-[4px] bg-accent" style={{ width: `${bar.value / max * 100}%` }} />
          </span>
          <span className="whitespace-nowrap text-right tabular-nums text-ink">
            {formatNumber(bar.value)}
            {unit}
            {bar.note && <span className="ml-1.5 text-ink2">{bar.note}</span>}
          </span>
        </li>
      )}
    </ul>);

}

function Panel({ title, children }: {title: string;children: React.ReactNode;}) {
  return (
    <section className="rounded-2xl border border-line p-5">
      <h3 className="text-body font-bold text-ink">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>);

}

const nameOf = (candidate: RuleCandidate) => `${categoryLabel(candidate.merchantCategory)}(${candidate.industryCode})`;

/**
 * 규칙 후보 통계. 지금 있는 후보 목록 API 를 끝까지 한 번 읽어 화면에서 센다. 통계 API 가 없어도 되는 것만 둔다:
 * 상태별 수, 규칙이 없어 확인 필요가 된 판정이 많이 쌓인 후보, 초안이 인용한 근거의 위계
 */
export function CandidateStats() {
  const allQ = useApi(() => readAll((page, size) => api.admin.ruleCandidates.list({ page, size })), []);

  if (allQ.error)
  return (
    <p role="alert" className="text-small text-deny">
        후보 통계를 불러오지 못했습니다.{' '}
        <Button variant="ghost" size="inline" onClick={allQ.reload}>
          다시 시도
        </Button>
      </p>);


  if (!allQ.data) return <span className="block h-64 animate-pulse rounded-2xl bg-line2" />;

  const stats = candidateStats(allQ.data, nameOf);
  if (stats.total === 0) return <p className="text-body text-ink2">아직 규칙 후보가 없습니다.</p>;

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
        {stats.tiles.map((tile) =>
        <div key={tile.label} className="bg-canvas px-5 py-4">
            <dt className="text-caption text-ink2">{tile.label}</dt>
            <dd className="mt-1 text-h3 font-bold tabular-nums text-ink">{tile.value}</dd>
          </div>
        )}
      </dl>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="상태별 후보">
          <BarList bars={stats.byStatus} unit="건" />
        </Panel>
        <Panel title="초안이 인용한 근거">
          <BarList bars={stats.byTier} unit="건" />
        </Panel>
      </div>
      <Panel title="규칙이 없어 확인 필요가 된 판정이 많은 후보">
        <BarList bars={stats.topUnmatched} unit="건" />
      </Panel>
    </div>);

}
