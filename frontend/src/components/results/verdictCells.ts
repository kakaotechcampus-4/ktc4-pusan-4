import type { Judgment, Verdict } from '../../types/domain';
import { formatFullDate, formatWon } from '../../utils/format';
import { AWAITING_ANSWER } from '../../utils/verdict';
import { merchantTitle } from './display';

/**
 * 칸 하나의 상태. 판정 셋과 답변 대기(불가에 붙는 표지), 판정 전(회색),
 * 판정은 끝났지만 화면이 아직 받지 못한 칸(SEEN, 판정 진행에서 한 번에 100건 넘게 왔을 때)
 */
export type CellState = Verdict | 'AWAITING' | 'PENDING' | 'SEEN';

export interface GridCell {
  key: string;
  state: CellState;
  /** 2026-09-14 꼴. 달로 묶을 때 쓴다 */
  date?: string;
  /** 마우스를 올리면 뜨는 줄. 첫 줄은 굵게 쓴다 */
  tip?: string[];
}

/** 한 줄의 칸 수. GitHub 기여 그래프처럼 위에서 아래로 일곱 칸 채우고 옆 줄로 간다 */
export const ROWS = 7;

/**
 * 판정 칸 띠를 그리는 최대 판정 수. 넘으면 칸이 8px 아래로 작아져 가리키거나 읽을 수 없다.
 * 그때 결과와 판정 진행은 판정별 몫 막대를 그린다(11/11 치오)
 */
export const GRID_MAX = 1000;


/** 판정 하나의 칸. 답변 대기는 불가에 붙는 표지라 따로 그린다. 말풍선에 가맹점, 날짜, 금액, 판정을 쓴다 */
export const judgmentCell = (judgment: Judgment): GridCell => ({
  key: judgment.transactionId,
  state: judgment.awaitingAnswer ? 'AWAITING' : judgment.verdict.code,
  date: judgment.transaction.approvedAt.slice(0, 10),
  tip: [
  merchantTitle(judgment.transaction),
  `${formatFullDate(judgment.transaction.approvedAt)}  ${formatWon(judgment.transaction.amount)}`,
  judgment.awaitingAnswer ? `${judgment.verdict.label}, ${AWAITING_ANSWER}` : judgment.verdict.label]

});

/**
 * 자리 폭에 맞춘 칸 배치(fit).
 * - side: 달을 옆으로 나란히 두고 모든 달이 rows 줄이다(GitHub 기여 그래프처럼)
 * - stack: 달마다 한 줄 띠로 폭을 다 쓰고 아래로 쌓는다. 달마다 columns 칸을 채우고 다음 줄로 간다
 */
export type GridLayout =
{mode: 'side';rows: number;cell: number;gap: number;} |
{mode: 'stack';columns: number;cell: number;gap: number;};

/** 달 묶음 사이의 거리. VerdictGrid 의 gap-x-6, gap-y-3 과 같다 */
export const GROUP_GAP = 24;
export const STACK_GAP = 12;
/** 달 이름 한 줄(12px 글자, 18px 줄)과 그 아래 8px */
const LABEL_HEIGHT = 26;
const MIN_SIDE_CELL = 6;
const MIN_STACK_CELL = 2;
/** 띠가 이보다 높아지지 않는다. 거래가 아주 많으면 칸이 점처럼 작아진다 */
export const FIT_MAX_HEIGHT = 280;

const gapFor = (cell: number) => cell >= 10 ? 3 : cell >= 5 ? 2 : 1;
/** 거래가 적으면 칸을 더 키운다. 그보다 크면 칸이 아니라 단추처럼 보인다 */
const maxCellFor = (total: number) => total <= 20 ? 40 : 32;

/**
 * 거래 수와 자리 폭으로 칸 크기와 배치를 정한다(11/11 치오: 1만 건이면 띠가 화면 밖으로 나갔고, 몇 건이면 너무 작았다).
 * 옆으로 나란히(일곱 줄까지)와 달마다 띠로 쌓기를 둘 다 재 보고 칸이 더 큰 쪽을 고른다. 같으면 나란히다.
 * 나란히는 폭을 가장 많이 채우는 줄 수를 고르되 두 줄은 띠처럼 보여 덜 고르고, 한 줄은 여덟 건 이하일 때만 쓴다.
 * 높이는 maxHeight 를 넘지 않는다
 */
export function fitLayout(groupSizes: number[], width: number, labelled: boolean, maxHeight = FIT_MAX_HEIGHT): GridLayout | null {
  const sizes = groupSizes.filter((size) => size > 0);
  if (sizes.length === 0 || width <= 0) return null;
  const total = sizes.reduce((sum, size) => sum + size, 0);
  const largest = Math.max(...sizes);
  const maxCell = maxCellFor(total);
  const label = labelled ? LABEL_HEIGHT : 0;

  let side: (GridLayout & {score: number;}) | null = null;
  for (let rows = total <= 8 ? 1 : 2; rows <= Math.min(ROWS, Math.max(2, largest)); rows += 1) {
    const columns = sizes.reduce((sum, size) => sum + Math.ceil(size / rows), 0);
    const cellWith = (gap: number) =>
    Math.min(maxCell, Math.floor((width - GROUP_GAP * (sizes.length - 1) - gap * (columns - sizes.length)) / columns));
    const gap = gapFor(cellWith(3));
    const cell = cellWith(gap);
    if (cell < MIN_SIDE_CELL) continue;
    if (label + rows * cell + (rows - 1) * gap > maxHeight) continue;
    const used = columns * cell + gap * (columns - sizes.length) + GROUP_GAP * (sizes.length - 1);
    const shape = rows === 1 ? 0.7 : rows === 2 ? 0.6 : 1;
    const score = used / width * shape;
    if (!side || score > side.score + 1e-9) side = { mode: 'side', rows, cell, gap, score };
  }

  const stackWith = (cell: number): GridLayout => {
    const gap = gapFor(cell);
    return { mode: 'stack', columns: Math.max(1, Math.floor((width + gap) / (cell + gap))), cell, gap };
  };
  const heightOf = (layout: GridLayout & {mode: 'stack';}) =>
  sizes.reduce((sum, size) => {
    const rows = Math.ceil(size / layout.columns);
    return sum + label + rows * layout.cell + (rows - 1) * layout.gap;
  }, 0) + STACK_GAP * (sizes.length - 1);
  let stack: GridLayout | null = null;
  for (let cell = maxCell; cell >= MIN_STACK_CELL && !stack; cell -= 1) {
    const candidate = stackWith(cell) as GridLayout & {mode: 'stack';};
    if (heightOf(candidate) <= maxHeight) stack = candidate;
  }

  // 띠로 쌓으면 달마다 한두 줄 띠가 된다. 칸이 확실히 클 때(1.5배)만 나란히 대신 쓴다
  if (side && (!stack || stack.cell < side.cell * 1.5)) return { mode: 'side', rows: side.rows, cell: side.cell, gap: side.gap };
  // 좁은 화면에 아주 많으면 가장 작은 칸으로도 높이에 안 든다. 그때는 높이를 넘겨 아래로 늘린다
  return stack ?? stackWith(MIN_STACK_CELL);
}
