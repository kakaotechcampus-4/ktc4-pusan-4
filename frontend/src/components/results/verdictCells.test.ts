import { describe, expect, it } from 'vitest';
import { FIT_MAX_HEIGHT, fitLayout, GROUP_GAP, STACK_GAP, type GridLayout } from './verdictCells';

/** 배치가 차지하는 폭과 높이. VerdictGrid 가 그리는 것과 같은 셈이다 */
const box = (sizes: number[], layout: GridLayout, labelled: boolean) => {
  const label = labelled ? 26 : 0;
  if (layout.mode === 'side') {
    const columns = sizes.reduce((sum, size) => sum + Math.ceil(size / layout.rows), 0);
    return {
      width: columns * layout.cell + layout.gap * (columns - sizes.length) + GROUP_GAP * (sizes.length - 1),
      height: label + layout.rows * layout.cell + (layout.rows - 1) * layout.gap
    };
  }
  const width = Math.max(...sizes.map((size) => Math.min(size, layout.columns))) * (layout.cell + layout.gap) - layout.gap;
  const height = sizes.reduce((sum, size) => {
    const rows = Math.ceil(size / layout.columns);
    return sum + label + rows * layout.cell + (rows - 1) * layout.gap;
  }, 0) + STACK_GAP * (sizes.length - 1);
  return { width, height };
};

describe('fitLayout', () => {
  it('몇 건뿐이면 큰 칸 한 줄로 둔다', () => {
    expect(fitLayout([3], 592, true)).toMatchObject({ mode: 'side', rows: 1, cell: 40 });
    expect(fitLayout([6], 800, true)).toMatchObject({ mode: 'side', rows: 1, cell: 40 });
  });

  it('스무 건 남짓이면 칸을 키워 덩어리로 두고 한 줄 띠로 늘이지 않는다', () => {
    const layout = fitLayout([23], 592, true);
    expect(layout).toMatchObject({ mode: 'side', cell: 32 });
    if (layout?.mode === 'side') expect(layout.rows).toBeGreaterThanOrEqual(3);
  });

  it('석 달 52건은 달을 나란히 두고 폭을 거의 다 채운다', () => {
    const sizes = [17, 18, 17];
    const layout = fitLayout(sizes, 592, true);
    expect(layout?.mode).toBe('side');
    if (layout) expect(box(sizes, layout, true).width / 592).toBeGreaterThan(0.85);
  });

  it('1만 건은 달마다 띠로 쌓고 폭을 넘지 않는다. 넓으면 높이도 넘지 않는다', () => {
    const sizes = [3334, 3333, 3333];
    for (const width of [294, 592, 800]) {
      const layout = fitLayout(sizes, width, true);
      expect(layout?.mode).toBe('stack');
      if (layout) {
        const size = box(sizes, layout, true);
        expect(size.width).toBeLessThanOrEqual(width);
        if (width >= 592) expect(size.height).toBeLessThanOrEqual(FIT_MAX_HEIGHT);
      }
    }
  });

  it('석 달 300건은 칸이 확실히 커지는 띠로 쌓는다', () => {
    const sizes = [100, 100, 100];
    const layout = fitLayout(sizes, 592, true);
    expect(layout?.mode).toBe('stack');
    if (layout) expect(box(sizes, layout, true).height).toBeLessThanOrEqual(FIT_MAX_HEIGHT);
  });

  it('진행 중처럼 달로 묶지 않은 칸도 폭과 높이 안에 든다', () => {
    const layout = fitLayout([10000], 700, false);
    expect(layout).not.toBeNull();
    if (layout) {
      const size = box([10000], layout, false);
      expect(size.width).toBeLessThanOrEqual(700);
      expect(size.height).toBeLessThanOrEqual(FIT_MAX_HEIGHT);
    }
  });

  it('잴 폭이 없으면(테스트, 서버 렌더) 정하지 않는다', () => {
    expect(fitLayout([10], 0, true)).toBeNull();
  });
});
