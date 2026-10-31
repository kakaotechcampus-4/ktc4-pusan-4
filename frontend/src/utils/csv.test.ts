import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  it('쉼표·따옴표·줄바꿈이 든 칸만 감싸고, 비어 있으면 빈칸이다', () => {
    expect(toCsv([['a', 'b,c', 'say "hi"', 'x\ny', null, 3]])).toBe('a,"b,c","say ""hi""","x\ny",,3');
  });

  it('수식으로 읽힐 글자로 시작하면 앞에 따옴표를 붙인다', () => {
    expect(toCsv([['=SUM(A1)', '-3', '@cmd']])).toBe("'=SUM(A1),'-3,'@cmd");
  });

  it('숫자는 음수여도 그대로 둔다', () => {
    expect(toCsv([[-1200]])).toBe('-1200');
  });
});

describe('judgmentsCsv', () => {
  it('엑셀이 한글을 읽도록 BOM 으로 시작하고, 승인일은 ISO 날짜다', async () => {
    const { judgmentsCsv } = await import('./csv');
    const text = judgmentsCsv([
    {
      transaction: {
        approvedAt: '2026-01-31T09:00:00+09:00',
        merchantNorm: '가게',
        merchantRaw: '가게 본점',
        merchantCategory: '식비',
        amount: 1000,
        installmentMonths: 0
      },
      verdict: { code: 'AVAILABLE', label: '가능' },
      finalAmount: 1000,
      origin: { type: 'RUN', id: 'r' },
      outOfScope: false,
      citations: [{ statuteVersionId: 1, statuteId: '소득세법-27-1' }]
    } as unknown as import('../types/domain').Judgment]
    );
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text.split('\r\n')[1]).toBe('2026-01-31,가게,가게 본점,식비,1000,0,가능,1000,,,소득세법-27-1');
  });
});
