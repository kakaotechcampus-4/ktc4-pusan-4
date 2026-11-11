import { describe, expect, it } from 'vitest';
import { CARDS, cardById } from './cards';
import { cardSummary } from './summary';

const summaryOf = (id: string) => {
  const card = cardById(id);
  if (!card) throw new Error(`${id} 카드가 없습니다`);
  return cardSummary(card);
};

describe('cardSummary', () => {
  it('카테고리와 판정으로 한 줄을 만든다. 받침에 맞춰 로, 으로를 붙인다', () => {
    expect(summaryOf('R-001')).toBe('조세 결제는 불가로 판정합니다.');
    expect(summaryOf('R-940909201')).toBe('사무용품 결제는 가능으로 판정합니다.');
  });

  it('이름에 든 말, 금액, 주말 조건을 앞에 둔다', () => {
    expect(summaryOf('R-002')).toBe('가산금, 강제징수 같은 말이 든 결제는 불가로 판정합니다.');
    expect(summaryOf('R-107')).toBe('10만 원 넘는 해외SaaS 결제는 질문에 답하면 정합니다.');
    expect(summaryOf('R-940909100')).toBe('10만 원 이하 해외SaaS 결제는 가능으로 판정합니다.');
    expect(summaryOf('R-311')).toBe('주말이나 공휴일의 음식점 결제는 불가로 판정합니다. 질문에 답하면 바뀔 수 있습니다.');
  });

  it('세무사에게 넘기는 카드와 판정이 없는 자산, 증빙 카드도 말한다', () => {
    expect(summaryOf('R-070')).toBe('차량 결제는 세무사에게 넘깁니다.');
    expect(summaryOf('R-240')).toBe('100만 원 이하 사무용품, 온라인쇼핑 결제는 바로 경비로 처리하는 자산으로 표시합니다.');
    expect(summaryOf('R-060')).toBe('3만 원 넘는 결제는 적격증빙이 필요하다고 표시합니다.');
  });

  it('모든 카드가 한두 문장, 60자 안이다', () => {
    for (const card of CARDS) {
      const text = cardSummary(card);
      expect(text, card.id).toMatch(/다\.$/);
      expect(text.length, card.id).toBeLessThanOrEqual(60);
    }
  });
});
