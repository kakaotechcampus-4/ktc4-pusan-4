import { describe, expect, it, vi } from 'vitest';
import { readAll, readUnavailableSplit } from './readAll';

/** items 를 size 개씩 나눈 page 번째 쪽 */
const pageOf = <T,>(items: T[], page: number, size: number) => ({
  items: items.slice(page * size, (page + 1) * size),
  page: {
    number: page,
    size,
    totalElements: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / size)),
    hasNext: (page + 1) * size < items.length
  }
});

describe('readAll', () => {
  it('쪽을 끝까지 읽는다', async () => {
    const items = Array.from({ length: 250 }, (_, index) => index);
    const fetchPage = vi.fn((page: number, size: number) => Promise.resolve(pageOf(items, page, size)));
    expect(await readAll(fetchPage)).toEqual(items);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });
});

describe('readUnavailableSplit', () => {
  it('불가와 질문이 100개를 넘어도 답변 대기를 빠짐없이 가른다', async () => {
    const ids = Array.from({ length: 230 }, (_, index) => `t${index}`);
    const judgments = ids.map((transactionId) => ({ transactionId, verdict: { code: 'UNAVAILABLE' } }));
    // 질문은 뒤쪽 거래에만 걸려 있다. 첫 쪽만 읽으면 하나도 못 찾는다
    const questions = ids.slice(150).map((transactionId) => ({ transactionId }));
    const api = {
      judgments: { list: vi.fn(({ page, size }) => Promise.resolve(pageOf(judgments, page, size))) },
      questions: { list: vi.fn(({ page, size }) => Promise.resolve(pageOf(questions, page, size))) }
    } as unknown as Parameters<typeof readUnavailableSplit>[0];

    const split = await readUnavailableSplit(api, { batchId: 'b' }, 'b');
    expect(split.awaiting).toHaveLength(80);
    expect(split.confirmed).toHaveLength(150);
    expect(split.pendingTransactionIds.has('t229')).toBe(true);
  });
});
