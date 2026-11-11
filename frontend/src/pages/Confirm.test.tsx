// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JudgmentRun } from '../types/domain';
import { Confirm } from './Confirm';

const { api, session } = vi.hoisted(() => ({
  api: {
    runs: { active: vi.fn(), create: vi.fn() },
    uploads: { get: vi.fn() },
    transactions: { list: vi.fn() }
  },
  session: {
    batchId: 'batch-1',
    batchStatus: 'ready',
    reloadBatch: vi.fn(),
    context: null,
    contextRef: null,
    contextStatus: 'none',
    reloadContext: vi.fn()
  }
}));

vi.mock('../api', async () => ({
  api,
  useApi: (await vi.importActual<typeof import('../api/hooks')>('../api/hooks')).useApi,
  ApiRequestError: (await vi.importActual<typeof import('../api/contract')>('../api/contract')).ApiRequestError
}));
vi.mock('../components/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));
vi.mock('../components/StepEyebrow', () => ({ StepEyebrow: () => null }));
vi.mock('../contexts/SessionContext', () => ({ useSession: () => session }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const running: JudgmentRun = {
  id: 'run-9',
  batchId: 'batch-other',
  contextId: 'ctx',
  contextVersion: 1,
  status: { code: 'RUNNING', label: '실행 중' },
  totalCount: 9,
  processedCount: 2,
  failedCount: 0,
  startedAt: '2026-11-08T10:00:00Z',
  completedAt: null
};

const emptyPage = { items: [], page: { number: 0, size: 1, totalElements: 0, totalPages: 1, hasNext: false } };

function RunPage() {
  const { runId } = useParams();
  return <p>진행 화면 {runId}</p>;
}

let container: HTMLDivElement;
let root: Root;

const mount = async () => {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/confirm']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/confirm" element={<Confirm />} />
          <Route path="/run/:runId" element={<RunPage />} />
        </Routes>
      </MemoryRouter>
    );
  });
};

const text = () => container.textContent ?? '';

beforeEach(() => {
  vi.resetAllMocks();
  api.uploads.get.mockResolvedValue({ id: 'batch-1', periodStart: '2026-01-01', periodEnd: '2026-03-31' });
  api.transactions.list.mockResolvedValue(emptyPage);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Confirm', () => {
  it('진행 중인 판정이 있으면 동의를 다시 받지 않고 그 진행 화면으로 간다. 다른 업로드의 판정이어도 같다', async () => {
    api.runs.active.mockResolvedValue(running);
    await mount();

    expect(text()).toContain('진행 화면 run-9');
    expect(text()).not.toContain('판정 전 확인');
    expect(api.runs.create).not.toHaveBeenCalled();
  });

  it('진행 중인 판정이 없으면 확인 화면을 보인다', async () => {
    api.runs.active.mockResolvedValue(null);
    await mount();

    expect(text()).toContain('판정 전 확인');
  });

  it('진행 중인지 읽지 못해도 확인 화면을 보인다. 시작은 서버가 막는다', async () => {
    api.runs.active.mockRejectedValue(new Error('network'));
    await mount();

    expect(text()).toContain('판정 전 확인');
  });
});
