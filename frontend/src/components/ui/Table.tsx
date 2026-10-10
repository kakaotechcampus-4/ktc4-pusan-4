import React from 'react';
import { cn } from './cn';

export interface Column<T> {
  /** 헤더 문구. 숫자 열은 align: 'right' 와 함께 쓴다 */
  header: React.ReactNode;
  /** 한 행을 어떻게 그릴지 */
  cell: (row: T) => React.ReactNode;
  align?: 'left' | 'right';
  /** 좁은 화면에서 숨길 열. 핵심 정보에는 쓰지 않는다 */
  hideBelow?: 'sm' | 'md' | 'lg';
  /** 고정 폭이 필요할 때만 (예: 'w-28') */
  width?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** 접근성용 표 설명 */
  caption: string;
  /** 행 클릭. 주면 행 전체가 버튼처럼 동작한다 (Enter·Space 로도 눌린다) */
  onRowClick?: (row: T) => void;
  /** 지금 선택된 행 */
  selectedKey?: string;
  /** rows 가 비었을 때 표 대신 보여줄 것 */
  empty?: React.ReactNode;
  /** 첫 로딩 중이면 골격을 보여준다 */
  loading?: boolean;
  className?: string;
}

const HIDE = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell'
} as const;

/**
 * 목록 표. 거래·업로드 이력·판정 결과가 함께 쓴다.
 * 정렬·페이지네이션은 서버가 하므로 여기서는 그리기만 한다.
 */
export function Table<T>({
  columns,
  rows,
  rowKey,
  caption,
  onRowClick,
  selectedKey,
  empty,
  loading = false,
  className
}: TableProps<T>) {
  if (!loading && rows.length === 0 && empty) return <>{empty}</>;

  const cellClass = (column: Column<T>) =>
  cn(
    'px-4 py-3 text-body',
    column.align === 'right' ? 'text-right tabular-nums' : 'text-left',
    column.width,
    column.hideBelow && HIDE[column.hideBelow]
  );

  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-line bg-surface', className)}>
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line">
            {columns.map((column, index) =>
            <th
              key={index}
              scope="col"
              className={cn(cellClass(column), 'py-2.5 text-small font-medium text-muted')}>

                {column.header}
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-line2">
          {loading &&
          rows.length === 0 &&
          Array.from({ length: 5 }).map((_, rowIndex) =>
          <tr key={`skeleton-${rowIndex}`}>
                {columns.map((column, index) =>
            <td key={index} className={cellClass(column)}>
                    <span className="block h-4 w-full animate-pulse rounded bg-line2" />
                  </td>
            )}
              </tr>
          )}

          {rows.map((row) => {
            const key = rowKey(row);
            const selected = key === selectedKey;
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                aria-current={selected ? 'true' : undefined}
                onKeyDown={
                onRowClick ?
                (event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  onRowClick(row);
                } :
                undefined
                }
                className={cn(
                  'transition-colors duration-150',
                  onRowClick &&
                  'cursor-pointer hover:bg-canvas focus-visible:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                  selected && 'bg-accent-soft/50'
                )}>

                {columns.map((column, index) =>
                <td key={index} className={cellClass(column)}>
                    {column.cell(row)}
                  </td>
                )}
              </tr>);

          })}
        </tbody>
      </table>
    </div>);

}

interface PaginationProps {
  page: { number: number; totalPages: number; totalElements: number; hasNext: boolean };
  onChange: (page: number) => void;
  /** 표 아래 왼쪽에 덧붙일 설명 */
  note?: React.ReactNode;
}

/** 표 아래 페이지 이동. 서버 페이지네이션(0-based)을 그대로 따른다. */
export function Pagination({ page, onChange, note }: PaginationProps) {
  const first = page.totalElements === 0 ? 0 : page.number * 20 + 1;
  const last = Math.min((page.number + 1) * 20, page.totalElements);

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-small text-muted">
      <span className="tabular-nums">
        {note ?? `${first}–${last} / ${page.totalElements.toLocaleString('ko-KR')}건`}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page.number === 0}
          onClick={() => onChange(page.number - 1)}
          className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink transition-colors duration-150 hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40">

          이전
        </button>
        <span className="tabular-nums">
          {page.number + 1} / {Math.max(1, page.totalPages)}
        </span>
        <button
          type="button"
          disabled={!page.hasNext}
          onClick={() => onChange(page.number + 1)}
          className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink transition-colors duration-150 hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40">

          다음
        </button>
      </div>
    </div>);

}
