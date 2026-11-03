import { describe, expect, it } from 'vitest';
import type { Judgment } from '../types/domain';
import { limitExcess } from './limit';

const row = (code: string, account: string | null, finalAmount: number, allowedAmount: number) => ({
  judgment: { verdict: { code }, account, finalAmount } as unknown as Judgment,
  allowedAmount,
  answers: []
});

describe('limitExcess', () => {
  it('가능으로 판정한 접대비의 finalAmount − allowedAmount 만 더한다', () => {
    expect(
      limitExcess([
      row('AVAILABLE', '접대비', 500_000, 300_000),
      row('AVAILABLE', '접대비', 200_000, 200_000),
      // 한도가 없는 계정과 확인 필요는 차이가 있어도 초과액이 아니다
      row('AVAILABLE', '소모품비', 90_000, 80_000),
      row('NEEDS_REVIEW', '접대비', 70_000, 0)]
      )
    ).toBe(200_000);
  });

  it('행이 없으면 0 이다', () => {
    expect(limitExcess([])).toBe(0);
  });
});
