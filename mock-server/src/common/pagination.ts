export interface Page<T> {
  items: T[];
  page: {
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
    hasNext: boolean;
  };
}

export function paginate<T>(items: T[], page = 0, size = 20): Page<T> {
  // page/size는 query string에서 온 값이라 NaN(예: ?page=abc)일 수 있다 — 그대로 두면
  // slice()/응답의 page.number 등이 전부 NaN으로 새어나간다. 문서 기본값(0, 20)으로 대체한다.
  const safePage = Number.isFinite(page) ? page : 0;
  const safeSize = Number.isFinite(size) ? size : 20;
  const clampedSize = Math.min(Math.max(safeSize, 1), 100);
  const clampedPage = Math.max(safePage, 0);
  const start = clampedPage * clampedSize;
  const totalElements = items.length;
  const totalPages = Math.ceil(totalElements / clampedSize);
  return {
    items: items.slice(start, start + clampedSize),
    page: {
      number: clampedPage,
      size: clampedSize,
      totalElements,
      totalPages,
      hasNext: start + clampedSize < totalElements,
    },
  };
}
