import { describe, expect, it } from 'vitest';
import type { Judgment, LimitYear } from '../types/domain';
import { exceededLimitOf, excessNote, limitLine, limitsOf } from './limit';

const limit = (taxYear: number, totalAmount: number, excessAmount: number, bucket = '접대비'): LimitYear => ({
  bucket,
  taxYear,
  totalAmount,
  excessAmount
});

const judgment = (code: string, approvedAt: string, bucket?: string, finalAmount: number | null = 50_000) =>
({
  verdict: { code },
  attributes: bucket ? { limit_bucket: bucket } : {},
  finalAmount,
  transaction: { approvedAt, amount: finalAmount ?? 50_000 }
}) as unknown as Judgment;

describe('limitsOf', () => {
  it('접대비 묶음만 연도순으로 고른다', () => {
    expect(limitsOf([limit(2026, 1, 0), limit(2025, 2, 0), limit(2026, 3, 0, '기부금')])).toEqual([
    limit(2025, 2, 0),
    limit(2026, 1, 0)]
    );
  });
});

describe('exceededLimitOf', () => {
  const limits = [limit(2025, 10_000_000, 0), limit(2026, 14_000_000, 1_750_000)];

  it('가능으로 판정한 접대비가 한도를 넘은 해에 있으면 그해 한도를 준다', () => {
    expect(exceededLimitOf(judgment('AVAILABLE', '2026-04-06T12:30:00', '접대비'), limits)).toEqual(limits[1]);
  });

  it('한도 안인 해, 한도 묶음이 없는 판정, 가능이 아닌 판정은 없다', () => {
    expect(exceededLimitOf(judgment('AVAILABLE', '2025-12-01T09:00:00', '접대비'), limits)).toBeUndefined();
    expect(exceededLimitOf(judgment('AVAILABLE', '2026-04-06T12:30:00'), limits)).toBeUndefined();
    expect(exceededLimitOf(judgment('NEEDS_REVIEW', '2026-04-06T12:30:00', '접대비'), limits)).toBeUndefined();
  });

  it('승인취소·환불(음수 금액)은 한도에 넣지 않는다. 서버가 인정 금액을 그대로 준다', async () => {
    expect(exceededLimitOf(judgment('AVAILABLE', '2026-04-10T12:30:00', '접대비', -6_500), limits)).toBeUndefined();
    // 금액 계산 전 판정은 결제금액으로 본다(LimitSettlementService)
    const refund = { ...judgment('AVAILABLE', '2026-04-10T12:30:00', '접대비', null), transaction: { approvedAt: '2026-04-10T12:30:00', amount: -6_500 } } as unknown as Judgment;
    expect(exceededLimitOf(refund, limits)).toBeUndefined();
  });
});

describe('limitLine · excessNote', () => {
  it('넘은 해는 총액과 초과액, 아니면 한도 안으로 적는다', () => {
    expect(limitLine(limit(2026, 14_000_000, 1_750_000))).toBe('2026년 접대비 총 14,000,000원 중 한도 초과 1,750,000원');
    expect(limitLine(limit(2025, 300_000, 0))).toBe('2025년 접대비 총 300,000원, 한도 안');
  });

  it('넘은 해만 연도별로 적고, 위 금액에서 빼지 않았다고 밝힌다', () => {
    expect(excessNote([limit(2026, 13_300_000, 1_051_000), limit(2025, 300_000, 0), limit(2026, 1, 1, '기부금')])).toBe(
      '2026년 접대비가 연간 한도를 1,051,000원 넘었습니다. 넘은 금액은 경비에 들어가지 않지만 위 금액에서는 빼지 않았습니다.'
    );
    expect(excessNote([limit(2026, 13_300_000, 1_051_000), limit(2025, 12_000_000, 200_000)])).toBe(
      '2025년 접대비가 연간 한도를 200,000원 넘었습니다. 2026년 접대비가 연간 한도를 1,051,000원 넘었습니다. 넘은 금액은 경비에 들어가지 않지만 위 금액에서는 빼지 않았습니다.'
    );
  });

  it('넘은 해가 없으면 안내가 없다', () => {
    expect(excessNote([limit(2026, 300_000, 0)])).toBeNull();
    expect(excessNote([])).toBeNull();
  });
});
