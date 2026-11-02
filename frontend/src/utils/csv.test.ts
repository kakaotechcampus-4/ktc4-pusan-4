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
    const judgment = {
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
    } as unknown as import('../types/domain').Judgment;
    const text = judgmentsCsv([
    { judgment, allowedAmount: 800, answers: [{ question: '용도는?', answer: '업무미팅' }] }]
    );
    expect(text.charCodeAt(0)).toBe(0xfeff);
    // 인정 금액은 finalAmount 가 아니라 한도까지 반영한 allowedAmount 다
    expect(text.split('\r\n')[1]).toBe('2026-01-31,가게,가게 본점,식비,1000,0,가능,800,,,소득세법-27-1,용도는? → 업무미팅');
  });

  it('「확인 필요」 행은 인정 금액을 비우고, 「불가」 행은 0 으로 쓴다', async () => {
    const { judgmentsCsv } = await import('./csv');
    const row = (code: string, label: string) => ({
      judgment: {
        transaction: { approvedAt: '2026-01-31T09:00:00+09:00', merchantNorm: '가게', merchantRaw: '', merchantCategory: '', amount: 1000, installmentMonths: 0 },
        verdict: { code, label },
        finalAmount: 0,
        origin: { type: 'RUN', id: 'r' },
        outOfScope: false,
        citations: []
      } as unknown as import('../types/domain').Judgment,
      allowedAmount: 0,
      answers: []
    });
    const [, review, unavailable] = judgmentsCsv([row('NEEDS_REVIEW', '확인 필요'), row('UNAVAILABLE', '불가')]).split('\r\n');
    expect(review).toBe('2026-01-31,가게,,,1000,0,확인 필요,,,,,');
    expect(unavailable).toBe('2026-01-31,가게,,,1000,0,불가,0,,,,');
  });

  it('서버가 어떤 순서로 주든 승인일 순으로 쓴다', async () => {
    const { judgmentsCsv } = await import('./csv');
    const row = (approvedAt: string) => ({
      judgment: {
        transaction: { approvedAt, merchantNorm: approvedAt.slice(0, 10), merchantRaw: '', merchantCategory: '', amount: 1, installmentMonths: 0 },
        verdict: { code: 'AVAILABLE', label: '가능' },
        finalAmount: 1,
        origin: { type: 'RUN', id: 'r' },
        outOfScope: false,
        citations: []
      } as unknown as import('../types/domain').Judgment,
      allowedAmount: 1,
      answers: []
    });
    // 실서버 내보내기는 computedAt DESC 로 온다
    const lines = judgmentsCsv([row('2026-01-20T09:00:00+09:00'), row('2026-01-03T09:00:00+09:00'), row('2026-01-11T09:00:00+09:00')]).
    split('\r\n').
    slice(1);
    expect(lines.map((line) => line.slice(0, 10))).toEqual(['2026-01-03', '2026-01-11', '2026-01-20']);
  });
});
