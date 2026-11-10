import type { Page } from '../types/domain';

/** 서버가 한 쪽에 주는 최대 행 수 */
const MAX_PAGE_SIZE = 100;

/** 쪽을 끝까지 읽어 한 배열로 모은다. 한 쪽(100개)만 읽으면 그 밖의 행이 말없이 빠진다 */
export async function readAll<T>(fetchPage: (page: number, size: number) => Promise<Page<T>>): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0;; page += 1) {
    const result = await fetchPage(page, MAX_PAGE_SIZE);
    all.push(...result.items);
    if (!result.page.hasNext || page + 1 >= result.page.totalPages) return all;
  }
}
