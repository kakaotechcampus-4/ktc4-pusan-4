import { describe, expect, it } from 'vitest';
import type { JudgmentSummary } from '../types/domain';
import { sharesOf, spendOf } from './shares';
import { verdictFilterQuery } from './verdict';

const summary = {
  byVerdict: {
    AVAILABLE: { count: 3, finalAmount: 20_000, spendAmount: 30_000 },
    NEEDS_REVIEW: { count: 1, finalAmount: 0, spendAmount: 5_000 },
    UNAVAILABLE: { count: 4, finalAmount: 0, spendAmount: 40_000 }
  },
  awaiting: { count: 1, spendAmount: 15_000 }
} as unknown as JudgmentSummary;

describe('sharesOf', () => {
  it('답변 대기를 불가에서 빼서 따로 둔다 (C12)', () => {
    expect(sharesOf(summary)).toEqual([
    { key: 'AVAILABLE', count: 3, amount: 30_000 },
    { key: 'NEEDS_REVIEW', count: 1, amount: 5_000 },
    { key: 'UNAVAILABLE', count: 3, amount: 25_000 },
    { key: 'AWAITING', count: 1, amount: 15_000 }]
    );
  });

  it('답변 대기가 없으면 그 줄을 두지 않는다', () => {
    expect(sharesOf({ ...summary, awaiting: { count: 0, spendAmount: 0 } }).map((share) => share.key)).toEqual([
    'AVAILABLE',
    'NEEDS_REVIEW',
    'UNAVAILABLE']
    );
  });

  it('결제 금액 합은 세 판정의 합이다. 답변 대기는 불가에 들어 있어 다시 더하지 않는다', () => {
    expect(spendOf(summary)).toBe(75_000);
  });
});

describe('verdictFilterQuery', () => {
  it('불가 필터는 답변 대기를 뺀 불가, 답변 대기 필터는 답변 대기만이다', () => {
    expect(verdictFilterQuery('ALL')).toEqual({});
    expect(verdictFilterQuery('AVAILABLE')).toEqual({ verdict: 'AVAILABLE' });
    expect(verdictFilterQuery('UNAVAILABLE')).toEqual({ verdict: 'UNAVAILABLE', awaiting: false });
    expect(verdictFilterQuery('AWAITING')).toEqual({ awaiting: true });
  });
});
