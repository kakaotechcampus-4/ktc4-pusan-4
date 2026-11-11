// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Judgment } from '../../types/domain';
import { JudgmentDetailPanel, type PanelCommand } from './JudgmentDetailPanel';

const { api } = vi.hoisted(() => ({
  api: {
    judgments: { list: vi.fn() },
    questions: { list: vi.fn() }
  }
}));

vi.mock('../../api', async () => ({
  api,
  ApiRequestError: (await vi.importActual<typeof import('../../api/contract')>('../../api/contract')).ApiRequestError,
  useApi: (await vi.importActual<typeof import('../../api/hooks')>('../../api/hooks')).useApi
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const judgment = {
  id: 'j1',
  transactionId: 't1',
  transaction: { id: 't1', approvedAt: '2026-09-01T10:00:00+09:00', amount: 12000, merchantRaw: '스타벅스', merchantNorm: '스타벅스', merchantCategory: '카페', installmentMonths: 0 },
  revision: 1,
  origin: { type: 'RUN', id: 'r1' },
  verdict: { code: 'AVAILABLE', label: '가능' },
  awaitingAnswer: false,
  outOfScope: false,
  blockedAtGate: null,
  account: null,
  accountLabel: null,
  finalAmount: 12000,
  isInference: false,
  unmatchedReason: null,
  attributes: {},
  ruleCardId: 'R-104',
  ruleCardVersion: 1,
  appliedRuleIds: ['R-104'],
  rulesCommitSha: null,
  userContextVersion: 1,
  explanation: null,
  computedAt: '2026-09-02T10:00:00+09:00',
  citations: []
} as unknown as Judgment;

let container: HTMLDivElement;
let root: Root;

const render = async (props: {command?: PanelCommand | null;onCommandDone?: () => void;focusKey?: number;}) => {
  await act(async () => {
    root.render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <JudgmentDetailPanel judgment={judgment} onChanged={() => undefined} onExcluded={() => undefined} {...props} />
      </MemoryRouter>
    );
  });
};

beforeEach(() => {
  vi.resetAllMocks();
  const empty = { items: [], page: { number: 0, size: 20, totalElements: 0, totalPages: 0, hasNext: false } };
  api.judgments.list.mockResolvedValue(empty);
  api.questions.list.mockResolvedValue({ ...empty, unresolved: { count: 0, amount: 0 } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('결과 표의 단축키가 패널에 시키는 일', () => {
  it('Delete 는 빼기 확인 창을 한 번 열고, 받았다고 알려 같은 명령이 다시 오지 않게 한다', async () => {
    const done = vi.fn();
    const command: PanelCommand = { kind: 'exclude', nonce: 1 };
    await render({ command, onCommandDone: done });
    expect(document.querySelector('[role="dialog"][aria-modal="true"]')).not.toBeNull();
    expect(done).toHaveBeenCalledTimes(1);

    // 같은 명령으로 다시 그려도 한 번 한 일은 다시 하지 않는다
    await render({ command, onCommandDone: done });
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('focusKey 가 0 이면 그려질 때 패널 제목으로 초점을 옮기지 않는다', async () => {
    const before = document.createElement('button');
    document.body.appendChild(before);
    before.focus();
    await render({ focusKey: 0 });
    expect(document.activeElement).toBe(before);
    before.remove();
  });
});
