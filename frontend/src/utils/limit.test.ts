import { describe, expect, it } from 'vitest';
import type { Judgment, LimitYear } from '../types/domain';
import { exceededLimitOf, limitsOf } from './limit';

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
