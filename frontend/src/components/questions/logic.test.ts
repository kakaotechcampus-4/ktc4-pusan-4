import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../../api/contract';
import type { Api } from '../../api/contract';
import type { Judgment, QuestionGroup } from '../../types/domain';
import {
  ANSWER_LABEL,
  answerLabel,
  respondOnce,
  tallyVerdicts,
  UNCONFIRMED_CODE,
  verdictsAfter,
  withHeld } from
'./logic';

const CARDS = resolve(process.cwd(), '..', 'rules', 'cards');

/** 카드마다 question.options 의 value. YAML 파서 없이 「- { value: …」 줄만 읽는다 */
const cardOptions = () =>
readdirSync(CARDS).
filter((name) => name.endsWith('.yaml')).
map((name) => ({
  name,
  values: [...readFileSync(join(CARDS, name), 'utf8').matchAll(/^\s*-\s*\{\s*value:\s*(?:"([^"]+)"|([^,}]+))/gm)].map(
    (match) => (match[1] ?? match[2]).trim()
  )
})).
filter((card) => card.values.length > 0);

const transaction = (id: string, amount: number) => ({
  questionId: `q-${id}`,
  transactionId: `t-${id}`,
  overridden: false,
  approvedAt: '2026-03-01T12:00:00+09:00',
  merchantRaw: '해운대바다횟집',
  merchantNorm: '해운대바다횟집',
  merchantCategory: '음식점',
  amount,
  installmentMonths: 0
});

const group = (patch: Partial<QuestionGroup> = {}): QuestionGroup => ({
  groupKey: 'transaction:t-1',
  factType: '용도',
  status: { code: 'PENDING', label: '대기' },
  questionIds: ['q-1'],
  count: 1,
  totalAmount: 240000,
  questionText: '이 식사는 어떤 용도였나요?',
  options: ['업무미팅', '개인'],
  answer: null,
  bulkAnswerable: true,
  transactions: [transaction('1', 240000)],
  ...patch
});

const judgment = (code: Judgment['verdict']['code'], label: string, amount: number, finalAmount = amount) =>
({ verdict: { code, label }, transaction: transaction('x', amount), finalAmount }) as unknown as Judgment;

const NETWORK = new ApiRequestError(0, 'NETWORK_ERROR', '서버에 연결하지 못했습니다.');

const fakeApi = () => {
  const api = {
    questions: { respond: vi.fn(), list: vi.fn() },
    judgments: { list: vi.fn() }
  };
  return { api, typed: api as unknown as Api };
};

describe('answerLabel', () => {
  it('뜻이 헷갈리는 값을 풀어 쓰고, 모르는 값은 그대로 둔다', () => {
    expect(answerLabel('혼자작업')).toBe('혼자 일함');
    expect(answerLabel('개인')).toBe('개인 용도');
    expect(answerLabel('업무미팅')).toBe('거래처 접대');
    expect(answerLabel('업무출장')).toBe('업무 출장');
    expect(answerLabel('카드에 없는 값')).toBe('카드에 없는 값');
  });

  it('룰카드의 어떤 선택지도 화면에서 가운뎃점, 낫표, 해요체로 보이지 않는다', () => {
    for (const card of cardOptions())
    for (const value of card.values) expect(answerLabel(value), card.name).not.toMatch(/[·・•「」『』]|요$/);
  });

  it('표의 값은 모두 지금 룰카드에 있다. 카드에서 값이 바뀌면 여기서 알린다', () => {
    const values = new Set(cardOptions().flatMap((card) => card.values));
    expect(Object.keys(ANSWER_LABEL).filter((value) => !values.has(value))).toEqual([]);
  });

  it('한 카드 안에서 두 선택지가 같은 이름이 되지 않는다', () => {
    for (const card of cardOptions()) {
      const labels = card.values.map(answerLabel);
      expect(new Set(labels).size, card.name).toBe(labels.length);
    }
  });
});

describe('respondOnce', () => {
  it('응답을 받으면 한 번만 보낸다', async () => {
    const { api, typed } = fakeApi();
    api.questions.respond.mockResolvedValue({ answeredCount: 1, factId: 'f', rejudgedTransactionCount: 1 });
    await respondOnce(typed, group(), '업무미팅');
    expect(api.questions.respond).toHaveBeenCalledWith({ questionIds: ['q-1'], answer: { value: '업무미팅' }, source: undefined });
    expect(api.questions.list).not.toHaveBeenCalled();
  });

  it('서버가 거절하면 저장 여부를 묻지 않고 그대로 실패한다', async () => {
    const { api, typed } = fakeApi();
    const rejected = new ApiRequestError(400, 'INVALID_ANSWER', '고를 수 없는 답입니다.');
    api.questions.respond.mockRejectedValue(rejected);
    await expect(respondOnce(typed, group(), '업무미팅')).rejects.toBe(rejected);
    expect(api.questions.list).not.toHaveBeenCalled();
  });

  it('응답을 잃었는데 같은 답이 저장돼 있으면 성공으로 보고 다시 보내지 않는다', async () => {
    const { api, typed } = fakeApi();
    api.questions.respond.mockRejectedValue(NETWORK);
    api.questions.list.mockResolvedValue({
      items: [
      { id: 'q-other', answer: { value: '개인' } },
      { id: 'q-1', answer: { value: '업무미팅' } }]

    });
    await expect(respondOnce(typed, group(), '업무미팅')).resolves.toBeUndefined();
    expect(api.questions.list).toHaveBeenCalledWith({ transactionId: 't-1', size: 100 });
    expect(api.questions.respond).toHaveBeenCalledTimes(1);
  });

  it('응답을 잃었고 저장되지 않았으면 원래 오류로 실패한다. 이전 답이 남아 있어도 같다', async () => {
    const { api, typed } = fakeApi();
    api.questions.respond.mockRejectedValue(NETWORK);
    api.questions.list.mockResolvedValue({ items: [{ id: 'q-1', answer: { value: '개인' } }] });
    await expect(respondOnce(typed, group(), '업무미팅')).rejects.toBe(NETWORK);
  });

  it('저장됐는지도 확인하지 못하면 그렇다고 알린다', async () => {
    const { api, typed } = fakeApi();
    api.questions.respond.mockRejectedValue(NETWORK);
    api.questions.list.mockRejectedValue(NETWORK);
    await expect(respondOnce(typed, group(), '업무미팅')).rejects.toMatchObject({ code: UNCONFIRMED_CODE });
  });
});

describe('tallyVerdicts', () => {
  it('판정별로 건수를 세고 가능은 경비 가능 금액을 더한다. 가능, 확인 필요, 불가 순이다', () => {
    expect(
      tallyVerdicts([
      judgment('UNAVAILABLE', '불가', 5000, 0),
      judgment('AVAILABLE', '가능', 240000),
      // 자산은 결제 금액이 아니라 그해 넣을 수 있는 만큼이다
      judgment('AVAILABLE', '가능', 1200000, 496100)]
      )
    ).toEqual([
    { verdict: { code: 'AVAILABLE', label: '가능' }, count: 2, amount: 736100 },
    { verdict: { code: 'UNAVAILABLE', label: '불가' }, count: 1, amount: null }]
    );
  });
});

describe('verdictsAfter', () => {
  it('묶인 거래마다 지금 판정을 하나씩 읽는다', async () => {
    const { api, typed } = fakeApi();
    api.judgments.list.mockResolvedValue({ items: [judgment('AVAILABLE', '가능', 240000)] });
    const tally = await verdictsAfter(typed, group({ transactions: [transaction('1', 240000), transaction('2', 240000)] }));
    expect(api.judgments.list.mock.calls).toEqual([[{ transactionId: 't-1', size: 1 }], [{ transactionId: 't-2', size: 1 }]]);
    expect(tally).toEqual([{ verdict: { code: 'AVAILABLE', label: '가능' }, count: 2, amount: 480000 }]);
  });

  it('하나라도 못 읽으면 null 이다', async () => {
    const { api, typed } = fakeApi();
    api.judgments.list.mockRejectedValue(NETWORK);
    await expect(verdictsAfter(typed, group())).resolves.toBeNull();
  });
});

describe('withHeld', () => {
  it('다시 읽은 목록에서 빠진 카드를 원래 자리로 되돌린다', () => {
    expect(withHeld(['A', 'C', 'D', 'E'], [{ index: 1, item: 'B' }])).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('여러 장을 답해도 각자 자리를 지킨다', () => {
    // B(1) 다음 A(0) 에 답했다. 서버 목록에는 둘 다 빠지고 뒤 페이지의 F 가 당겨졌다
    expect(
      withHeld(['C', 'D', 'E', 'F'], [
      { index: 0, item: 'A' },
      { index: 1, item: 'B' }]
      )
    ).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });

  it('목록이 짧아져도 뒤에 붙인다', () => {
    expect(withHeld([], [{ index: 3, item: 'B' }])).toEqual(['B']);
  });
});
