// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../api/contract';
import type { JudgmentRun, JudgmentSummary, RunStatus } from '../types/domain';
import { Run } from './Run';

const { api, session, showNudge } = vi.hoisted(() => ({
  api: {
    runs: { get: vi.fn(), failures: vi.fn(), create: vi.fn() },
    judgments: { summary: vi.fn() },
    progress: { get: vi.fn() },
    transactions: { get: vi.fn() }
  },
  session: { batchId: null as string | null, setBatchId: vi.fn() },
  showNudge: vi.fn()
}));

vi.mock('../api', async () => ({
  api,
  ApiRequestError: (await vi.importActual<typeof import('../api/contract')>('../api/contract')).ApiRequestError,
  isMock: false
}));
vi.mock('../components/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));
vi.mock('../components/assistant/context', () => ({ useAssistant: () => ({ showNudge }) }));
vi.mock('../contexts/SessionContext', () => ({ useSession: () => session }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const run = (code: RunStatus, over: Partial<JudgmentRun> = {}): JudgmentRun => ({
  id: 'run-1',
  batchId: 'batch-run',
  contextId: 'ctx',
  contextVersion: 3,
  status: { code, label: code },
  totalCount: 9,
  processedCount: code === 'RUNNING' ? 2 : 9,
  failedCount: 0,
  startedAt: '2026-11-06T12:00:00Z',
  completedAt: null,
  ...over
});

const summary = {
  byVerdict: {
    AVAILABLE: { count: 3 },
    NEEDS_REVIEW: { count: 2 },
    UNAVAILABLE: { count: 4 }
  }
} as unknown as JudgmentSummary;

let container: HTMLDivElement;
let root: Root;

const tick = (ms = 0) => act(async () => {
  await vi.advanceTimersByTimeAsync(ms);
});

const mount = async () => {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/run/run-1']}>
        <Routes>
          <Route path="/run/:runId" element={<Run />} />
          <Route path="/results" element={<p>결과 화면</p>} />
        </Routes>
      </MemoryRouter>
    );
  });
  await tick();
};

const text = () => container.textContent ?? '';
const control = (label: string) =>
[...container.querySelectorAll<HTMLElement>('button, a')].find((el) => el.textContent?.includes(label));
const click = (label: string) => act(async () => {
  control(label)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  vi.resetAllMocks();
  session.batchId = 'batch-run';
  api.progress.get.mockResolvedValue({ questions: { fillableFromPrevious: 0 } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('Run', () => {
  it('끝나면 판정별 건수와 결과 보기만 남는다. 단계 코드·실행 id·문진 버전을 보이지 않는다 (U7, C47)', async () => {
    api.runs.get.mockResolvedValue(run('COMPLETED'));
    api.judgments.summary.mockResolvedValue(summary);
    await mount();

    expect(text()).toContain('판정을 마쳤습니다');
    expect(text()).toContain('가능');
    expect(text()).toContain('3건');
    expect(control('결과 보기')).toBeDefined();
    expect(text()).not.toMatch(/G\d|run-1|문진 버전|실패 0건/);
    // 머리글(단계 띠)을 뺀 본문에는 가운뎃점과 낫표가 없다
    const body = [...container.querySelectorAll('header ~ *')].map((el) => el.textContent).join('');
    expect(body).not.toMatch(/[·・•「」『』]/);
  });

  it('진행 중 조회가 한 번 실패해도 진행 화면을 두고, 다시 올리라고 하지 않는다 (C63)', async () => {
    api.runs.get.
    mockResolvedValueOnce(run('RUNNING')).
    mockRejectedValueOnce(new ApiRequestError(500, 'INTERNAL_ERROR', '')).
    mockResolvedValue(run('COMPLETED'));
    api.judgments.summary.mockResolvedValue(summary);
    await mount();
    expect(text()).toContain('2 / 9건');

    await tick(1000);
    expect(text()).toContain('2 / 9건');
    expect(text()).toContain('연결이 불안정해 다시 확인하고 있습니다');
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(control('카드내역 올리기')).toBeUndefined();

    await tick(1000);
    expect(text()).toContain('판정을 마쳤습니다');
    expect(text()).not.toContain('연결이 불안정해');
  });

  it('없는 실행이면 멈추고 다른 업로드로 가는 길을 준다', async () => {
    api.runs.get.mockRejectedValue(new ApiRequestError(404, 'RUN_NOT_FOUND', ''));
    await mount();
    await tick(3000);

    expect(text()).toContain('판정을 찾을 수 없습니다');
    expect(control('카드내역 올리기')).toBeDefined();
    expect(api.runs.get).toHaveBeenCalledTimes(1);
  });

  it('집계를 못 읽어도 결과 보기를 두고 그 자리에서 다시 읽는다 (C62)', async () => {
    api.runs.get.mockResolvedValue(run('COMPLETED'));
    api.judgments.summary.mockRejectedValueOnce(new Error('down')).mockResolvedValue(summary);
    await mount();

    expect(text()).toContain('결과 건수를 불러오지 못했습니다');
    expect(control('결과 보기')).toBeDefined();
    expect(control('카드내역 올리기')).toBeUndefined();

    await click('다시 시도');
    await tick();
    expect(api.judgments.summary).toHaveBeenCalledTimes(2);
    expect(text()).not.toContain('결과 건수를 불러오지 못했습니다');
    expect(text()).toContain('4건');
  });

  it('지난번 답으로 채울 질문을 한 번 알린다', async () => {
    api.runs.get.mockResolvedValue(run('COMPLETED'));
    api.judgments.summary.mockResolvedValue(summary);
    api.progress.get.mockResolvedValue({ questions: { fillableFromPrevious: 2 } });
    await mount();

    expect(api.progress.get).toHaveBeenCalledWith('batch-run');
    expect(showNudge).toHaveBeenCalledTimes(1);
    expect(showNudge.mock.calls[0][1]).toBe('run:run-1');
  });

  it('판정한 거래가 0건이면 다 통과했다고 하지 않고 판정할 거래가 없다고 한다 (C39)', async () => {
    api.runs.get.mockResolvedValue(run('COMPLETED', { totalCount: 0, processedCount: 0 }));
    await mount();

    expect(text()).toContain('판정할 거래가 없습니다');
    expect(control('다시 올리기')).toBeDefined();
    expect(control('결과 보기')).toBeUndefined();
    expect(api.judgments.summary).not.toHaveBeenCalled();
  });

  it('일부가 실패하면 실패한 거래와 다시 판정하기를 보이고, 다시 판정하지 못하면 그 옆에 알린다', async () => {
    api.runs.get.mockResolvedValue(run('PARTIAL_FAILED', { processedCount: 8, failedCount: 1 }));
    api.judgments.summary.mockResolvedValue(summary);
    api.runs.failures.mockResolvedValue({ items: [{ transactionId: 'tx-1', errorCode: 'RUN_INTERRUPTED', message: '', failedAt: '' }] });
    api.transactions.get.mockResolvedValue({ id: 'tx-1', merchantNorm: '다온컴퍼니', amount: 12000 });
    api.runs.create.mockRejectedValue(new Error('down'));
    await mount();
    await tick();

    expect(text()).toContain('일부를 판정하지 못했습니다');
    expect(text()).toContain('1건을 판정하지 못했습니다');
    expect(text()).toContain('다온컴퍼니');
    expect(text()).toContain('중단됨');
    expect(control('결과 보기')).toBeDefined();

    await click('다시 판정하기');
    await tick();
    expect(api.runs.create).toHaveBeenCalledWith({ batchId: 'batch-run', contextId: 'ctx' });
    expect(text()).toContain('다시 판정하지 못했습니다');
    expect(control('결과 보기')).toBeDefined();
  });
});
