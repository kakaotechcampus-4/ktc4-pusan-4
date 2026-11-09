// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JudgmentRun } from '../types/domain';
import { AppShell } from './AppShell';

const { api, session } = vi.hoisted(() => ({
  api: {
    runs: { active: vi.fn() },
    progress: { get: vi.fn() }
  },
  session: { email: 'a@example.com', isAdmin: false, signOut: vi.fn(), batchId: null as string | null }
}));

vi.mock('../api', async () => ({
  api,
  useApi: (await vi.importActual<typeof import('../api/hooks')>('../api/hooks')).useApi
}));
vi.mock('../contexts/SessionContext', () => ({ useSession: () => session }));
vi.mock('./BugReport', () => ({ BugReportButton: () => null }));
vi.mock('./DisclaimerBar', () => ({ DisclaimerBar: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const running = { id: 'run-9', status: { code: 'RUNNING', label: '실행 중' } } as JudgmentRun;

let container: HTMLDivElement;
let root: Root;

const mount = async (path: string) => {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <AppShell>본문</AppShell>
      </MemoryRouter>
    );
  });
};

const link = (label: string) =>
[...container.querySelectorAll<HTMLAnchorElement>('a')].find((el) => el.textContent?.includes(label));

beforeEach(() => {
  vi.resetAllMocks();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('AppShell 진행 중 띠', () => {
  it('판정 중에 다른 화면에 가면 진행 화면으로 돌아가는 길을 띄운다', async () => {
    api.runs.active.mockResolvedValue(running);
    await mount('/transactions');

    expect(container.textContent).toContain('판정하고 있습니다');
    expect(link('진행 보기')?.getAttribute('href')).toBe('/run/run-9');
  });

  it('진행 중인 판정이 없거나 읽지 못하면 띄우지 않는다', async () => {
    api.runs.active.mockResolvedValue(null);
    await mount('/transactions');
    expect(link('진행 보기')).toBeUndefined();

    act(() => root.unmount());
    root = createRoot(container);
    api.runs.active.mockRejectedValue(new Error('network'));
    await mount('/uploads');
    expect(link('진행 보기')).toBeUndefined();
  });

  it('진행 화면과 판정 전 확인에서는 묻지도 띄우지도 않는다', async () => {
    api.runs.active.mockResolvedValue(running);
    await mount('/run/run-9');
    expect(link('진행 보기')).toBeUndefined();
    expect(api.runs.active).not.toHaveBeenCalled();
  });
});
