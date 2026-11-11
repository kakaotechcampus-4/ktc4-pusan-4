import { describe, expect, it } from 'vitest';
import type { RuleCandidate, RuleCandidateStatus } from '../../types/domain';
import { candidateStats } from './statsOf';

const candidate = (id: number, status: RuleCandidateStatus, occurrenceCount: number, extra: Partial<RuleCandidate> = {}) =>
({
  id,
  merchantCategory: `카테고리${id}`,
  industryCode: '940909',
  distinctUsers: 2,
  occurrenceCount,
  suggestedDocs: [],
  searchedTier: '법령',
  draftYaml: 'id: R-C1',
  status: { code: status, label: status },
  reviewedBy: null,
  reviewedAt: null,
  createdAt: '2026-11-01T00:00:00Z',
  ...extra
}) as RuleCandidate;

describe('candidateStats', () => {
  it('목록만으로 상태, 근거 위계, 많이 쌓인 후보를 센다', () => {
    const stats = candidateStats(
      [
      candidate(1, 'PENDING', 9),
      candidate(2, 'APPROVED', 3),
      candidate(3, 'REJECTED', 30, { searchedTier: '판례' }),
      candidate(4, 'ON_HOLD', 1, { draftYaml: null, searchedTier: null })],

      (item) => item.merchantCategory
    );
    expect(stats.total).toBe(4);
    expect(stats.tiles.map((tile) => tile.value)).toEqual(['4건', '1건', '43건', '50%']);
    expect(stats.byStatus.map((bar) => `${bar.label}${bar.value}`)).toEqual(['대기1', '보류1', '승인1', '기각1']);
    expect(stats.byTier.map((bar) => `${bar.label}${bar.value}`)).toEqual(['법령2', '판례1', '초안 없음1']);
    expect(stats.topUnmatched.map((bar) => bar.label)).toEqual(['카테고리3', '카테고리1', '카테고리2', '카테고리4']);
  });

  it('승인하거나 기각한 후보가 없으면 승인 비율을 비운다', () => {
    expect(candidateStats([candidate(1, 'PENDING', 1)], (item) => item.merchantCategory).tiles[3].value).toBe('-');
  });
});
