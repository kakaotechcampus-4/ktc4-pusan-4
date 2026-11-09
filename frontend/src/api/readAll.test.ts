import { describe, expect, it, vi } from 'vitest';
import { readAll } from './readAll';

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
