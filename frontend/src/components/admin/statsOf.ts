import type { RuleCandidate, RuleCandidateStatus } from '../../types/domain';
import { formatNumber } from '../../utils/format';

export interface Bar {
  key: string;
  label: string;
  value: number;
  /** 값 옆에 덧붙이는 말(사용자 수) */
  note?: string;
  title?: string;
}

const STATUS_ORDER: RuleCandidateStatus[] = ['PENDING', 'IN_REVIEW', 'ON_HOLD', 'APPROVED', 'REJECTED'];
const STATUS_LABEL: Record<RuleCandidateStatus, string> = {
  PENDING: '대기',
  IN_REVIEW: '검토 중',
  ON_HOLD: '보류',
  APPROVED: '승인',
  REJECTED: '기각'
};

/** 많이 쌓인 후보는 이만큼만 보인다 */
const TOP = 5;

/**
 * 후보 목록에서 세는 것. 서버 집계 없이 목록만으로 정해지는 값이다.
 * 승인 비율은 승인하거나 기각한 후보 가운데 승인한 몫이고, 아직 정한 후보가 없으면 비운다
 */
export function candidateStats(items: RuleCandidate[], nameOf: (candidate: RuleCandidate) => string) {
  const count = (status: RuleCandidateStatus) => items.filter((item) => item.status.code === status).length;
  const approved = count('APPROVED');
  const decided = approved + count('REJECTED');
  const occurrences = items.reduce((sum, item) => sum + item.occurrenceCount, 0);

  const tiers = new Map<string, number>();
  for (const item of items) {
    const tier = item.draftYaml === null ? '초안 없음' : item.searchedTier ?? '위계 모름';
    tiers.set(tier, (tiers.get(tier) ?? 0) + 1);
  }

  return {
    total: items.length,
    tiles: [
    { label: '전체 후보', value: `${formatNumber(items.length)}건` },
    { label: '대기', value: `${formatNumber(count('PENDING') + count('IN_REVIEW'))}건` },
    { label: '쌓인 미판정(누적)', value: `${formatNumber(occurrences)}건` },
    { label: '승인 비율', value: decided > 0 ? `${Math.round(approved / decided * 100)}%` : '-' }],

    byStatus: STATUS_ORDER.filter((status) => count(status) > 0).map((status): Bar => ({ key: status, label: STATUS_LABEL[status], value: count(status) })),
    byTier: [...tiers.entries()].sort((a, b) => b[1] - a[1]).map(([tier, value]): Bar => ({ key: tier, label: tier, value })),
    topUnmatched: [...items].
    sort((a, b) => b.occurrenceCount - a.occurrenceCount || b.distinctUsers - a.distinctUsers).
    slice(0, TOP).
    map((item): Bar => ({
      key: String(item.id),
      label: nameOf(item),
      value: item.occurrenceCount,
      note: `사용자 ${formatNumber(item.distinctUsers)}명`,
      title: `${nameOf(item)} ${STATUS_LABEL[item.status.code]}`
    }))
  };
}
