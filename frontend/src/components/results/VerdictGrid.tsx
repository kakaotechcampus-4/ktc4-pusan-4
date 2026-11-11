import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatNumber } from '../../utils/format';
import { fitLayout, ROWS, type CellState, type GridCell } from './verdictCells';

export type { CellState, GridCell } from './verdictCells';
import { AWAITING_ANSWER, VERDICT_LABEL } from '../../utils/verdict';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { cn } from '../ui';

/**
 * 판정색 채움. 막대와 같은 밝은 색이다(글자가 올라가지 않는다).
 * 답변 대기는 판정이 아니라 불가에 붙는 표지라 판정색 대신 테두리만 있는 빈 칸이다
 */
const FILL: Record<CellState, string> = {
  AVAILABLE: 'bg-ok-bar',
  NEEDS_REVIEW: 'bg-warn-bar',
  UNAVAILABLE: 'bg-deny-bar',
  AWAITING: 'border-[1.5px] border-edge bg-canvas',
  PENDING: 'bg-line',
  SEEN: 'bg-muted/40'
};

const LABEL: Record<CellState, string> = {
  ...VERDICT_LABEL,
  AWAITING: AWAITING_ANSWER,
  PENDING: '판정 전',
  SEEN: '판정함'
};

const ORDER: CellState[] = ['AVAILABLE', 'NEEDS_REVIEW', 'UNAVAILABLE', 'AWAITING', 'SEEN', 'PENDING'];

/** 칸 크기와 사이. md 는 결과와 판정 진행, sm 은 로그인 미리보기처럼 작은 자리 */
const SIZE = { md: { cell: 12, gap: 3 }, sm: { cell: 8, gap: 2 } } as const;


/** 처음 그릴 때 칸이 다 놓이기까지. 칸이 많아도 이보다 길어지지 않는다 */
const ENTER_MS = 700;

interface Group {
  id: string;
  label: string | null;
  cells: {cell: GridCell;index: number;}[];
}

const monthOf = (date: string | undefined) => date?.slice(0, 7) ?? '';

function groupCells(cells: GridCell[], byMonth: boolean): Group[] {
  const indexed = cells.map((cell, index) => ({ cell, index }));
  if (!byMonth || cells.some((cell) => !cell.date)) return [{ id: 'all', label: null, cells: indexed }];
  const months = new Map<string, Group['cells']>();
  for (const item of [...indexed].sort((a, b) => (a.cell.date ?? '').localeCompare(b.cell.date ?? '') || a.index - b.index)) {
    const month = monthOf(item.cell.date);
    months.set(month, [...(months.get(month) ?? []), item]);
  }
  const years = new Set([...months.keys()].map((month) => month.slice(0, 4)));
  return [...months.entries()].map(([month, items]) => {
    const [year, mm] = month.split('-');
    const label = years.size > 1 ? `${year}년 ${Number(mm)}월` : `${Number(mm)}월`;
    return { id: month, label, cells: items };
  });
}

/**
 * 판정 칸 띠. 거래 하나가 둥근 네모 한 칸이고 판정색이다. 달마다 묶는다(GitHub 기여 그래프처럼).
 *
 * 칸은 마우스로만 고른다. 같은 거래를 표에서 키보드로 고를 수 있어, 수백 칸을 Tab 순서에 넣지 않는다.
 * 화면 읽기 프로그램에는 판정별 건수 한 줄을 읽어 준다.
 *
 * 처음 그릴 때(animate) 칸이 차례로 들어오고, 그 뒤 상태가 바뀐 칸은 뒤집히며 새 색이 된다.
 * 움직임 줄이기를 켰으면 바로 놓인다
 */
export function VerdictGrid({
  cells,
  byMonth = true,
  size = 'md',
  selectedKey = null,
  onSelect,
  animate = false,
  legend = true,
  rows: fixedRows = ROWS,
  fit = false,
  className
}: {cells: GridCell[];byMonth?: boolean;size?: keyof typeof SIZE;selectedKey?: string | null;onSelect?: (key: string) => void;animate?: boolean;legend?: boolean;rows?: number;
  /** 자리 폭을 재서 칸 크기와 줄 수를 맞춘다. 거래가 적으면 칸이 커지고 많으면 줄이 는다 */
  fit?: boolean;className?: string;}) {
  const reduced = useReducedMotion();
  const groups = useMemo(() => groupCells(cells, byMonth), [cells, byMonth]);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = box.current;
    if (!fit || !element) return;
    const update = () => setWidth(element.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fit]);
  const layout = fit ?
  fitLayout(groups.map((group) => group.cells.length), width, groups.some((group) => group.label !== null)) :
  null;
  const px = layout?.cell ?? SIZE[size].cell;
  const gap = layout?.gap ?? SIZE[size].gap;
  const rowsOf = (count: number) => layout?.mode === 'side' ? Math.min(layout.rows, Math.max(1, count)) : fixedRows;
  /** 칸이 커지면 모서리도 같이 둥글어진다 */
  const radius = Math.max(2, Math.round(px / 4));
  const counts = useMemo(() => {
    const result = new Map<CellState, number>();
    for (const cell of cells) result.set(cell.state, (result.get(cell.state) ?? 0) + 1);
    return ORDER.filter((state) => result.has(state)).map((state) => ({ state, count: result.get(state) ?? 0 }));
  }, [cells]);
  /**
   * 칸마다 처음 놓일 때 정한 움직임을 기억한다. 다시 그릴 때(말풍선, 고른 칸) 클래스가 바뀌면 브라우저가
   * 움직임을 처음부터 다시 돌린다. 처음 그린 칸은 차례로 들어오고, 그 뒤 새로 놓이는 칸(상태가 바뀐 칸)은 뒤집힌다
   */
  const motionOf = useRef(new Map<string, {name: string;delay?: number;}>());
  const firstPaint = motionOf.current.size === 0;
  const step = cells.length > 0 ? Math.min(12, ENTER_MS / cells.length) : 0;
  const live = new Set<string>();
  const cellMotion = (cell: GridCell, index: number) => {
    const id = `${cell.key}:${cell.state}`;
    live.add(id);
    let found = motionOf.current.get(id);
    if (!found) {
      found = reduced ? { name: '' } : firstPaint ? animate ? { name: 'motion-safe:animate-cell', delay: Math.round(index * step) } : { name: '' } : { name: 'motion-safe:animate-flip' };
      motionOf.current.set(id, found);
    }
    return found;
  };
  useEffect(() => {
    // 사라진 칸은 잊는다. 같은 칸이 같은 상태로 돌아오면 다시 뒤집힌다
    for (const id of [...motionOf.current.keys()]) if (!live.has(id)) motionOf.current.delete(id);
  });
  const [tip, setTip] = useState<{index: number;x: number;y: number;} | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // 말풍선은 칸 가운데에 두되 화면 양끝에서 8px 안쪽으로 붙잡는다. 맨 왼쪽 칸에서 글자 앞이 잘렸다
    const element = tipRef.current;
    if (!tip || !element) return;
    const width = element.offsetWidth;
    const max = document.documentElement.clientWidth - width - 8;
    element.style.left = `${Math.max(8, Math.min(tip.x - width / 2, max))}px`;
  }, [tip]);

  const cellAt = (target: EventTarget | null) => {
    const element = target instanceof Element ? target.closest<HTMLElement>('[data-cell]') : null;
    const index = element ? Number(element.dataset.cell) : NaN;
    return Number.isNaN(index) || !element ? null : { index, element };
  };

  const summary = counts.map(({ state, count }) => `${LABEL[state]} ${formatNumber(count)}건`).join(', ');

  return (
    <div ref={box} className={className}>
      <div
        role="img"
        aria-label={summary}
        // 띠로 쌓으면 달마다 한 줄씩 아래로 놓는다
        className={layout?.mode === 'stack' ? 'flex flex-col gap-y-3' : 'flex flex-wrap gap-x-6 gap-y-4'}
        onPointerOver={(event) => {
          const found = cellAt(event.target);
          if (!found || !cells[found.index]?.tip) return setTip(null);
          const rect = found.element.getBoundingClientRect();
          setTip({ index: found.index, x: rect.left + rect.width / 2, y: rect.top });
        }}
        onPointerLeave={() => setTip(null)}
        onClick={(event) => {
          const found = cellAt(event.target);
          if (found && onSelect) onSelect(cells[found.index].key);
        }}>

        {groups.map((group) =>
        <div key={group.id} className="min-w-0">
            {group.label && <p className="mb-2 text-caption tabular-nums text-ink2">{group.label}</p>}
            <div
            aria-hidden="true"
            className={layout?.mode === 'stack' ? 'grid grid-flow-row' : 'grid grid-flow-col'}
            // 띠로 쌓으면 달마다 같은 칸 수로 왼쪽에서 오른쪽으로 채운다. 그래야 띠들의 오른쪽 끝이 맞는다
            style={
            layout?.mode === 'stack' ?
            { gridTemplateColumns: `repeat(${Math.min(layout.columns, group.cells.length)}, ${px}px)`, gridAutoRows: `${px}px`, gap: `${gap}px` } :
            { gridTemplateRows: `repeat(${rowsOf(group.cells.length)}, ${px}px)`, gridAutoColumns: `${px}px`, gap: `${gap}px` }
            }>

              {group.cells.map(({ cell, index }) => {
              const motion = cellMotion(cell, index);
              return (
                <span
                  // 상태가 바뀌면 새 칸으로 그려 뒤집히는 움직임이 돈다
                  key={`${cell.key}:${cell.state}`}
                  data-cell={index}
                  className={cn(
                    'block transition-shadow duration-150',
                    FILL[cell.state],
                    onSelect && 'cursor-pointer',
                    // 회색 판 위에서도 흰 테가 생기지 않게 고른 칸의 테와 칸 사이는 비워 둔다
                    cell.key === selectedKey && 'ring-2 ring-ink ring-offset-1 ring-offset-transparent',
                    motion.name
                  )}
                  style={{ borderRadius: radius, ...motion.delay ? { animationDelay: `${motion.delay}ms` } : {} }} />);

            })}
            </div>
          </div>
        )}
      </div>

      {legend && counts.length > 0 &&
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-caption text-ink2">
          {counts.map(({ state, count }) =>
        <li key={state} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={cn('h-2.5 w-2.5 rounded-[3px]', FILL[state])} />
              {LABEL[state]}
              <span className="tabular-nums text-ink">{formatNumber(count)}</span>
            </li>
        )}
        </ul>
      }

      {tip && cells[tip.index]?.tip && typeof document !== 'undefined' &&
      createPortal(
        <div
          ref={tipRef}
          role="tooltip"
          className="pointer-events-none fixed z-50 max-w-64 -translate-y-full rounded-xl bg-ink px-3 py-2 text-caption text-white"
          style={{ top: tip.y - 8 }}>

            {cells[tip.index].tip?.map((line, index) =>
          <p key={index} className={cn('whitespace-nowrap tabular-nums', index === 0 ? 'font-bold' : 'text-white/80')}>
                {line}
              </p>
          )}
          </div>,
        document.body
      )}
    </div>);

}
