// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../api/contract';
import type { UploadBatch } from '../types/domain';
import { Uploads } from './Uploads';

const { session, uploads } = vi.hoisted(() => ({
  session: {
    batchId: null as string | null,
    setBatchId: vi.fn(),
    reloadBatch: vi.fn()
  },
  uploads: { list: vi.fn(), remove: vi.fn() }
}));

vi.mock('../contexts/SessionContext', () => ({ useSession: () => session }));
vi.mock('../components/AppShell', () => ({
  AppShell: ({ children }: {children: React.ReactNode;}) => <>{children}</>
}));
vi.mock('../api', async () => ({
  api: { uploads },
  useApi: (await import('../api/hooks')).useApi,
  ApiRequestError: (await import('../api/contract')).ApiRequestError
}));

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean;}).IS_REACT_ACT_ENVIRONMENT = true;

const batch = (id: string, overrides: Partial<UploadBatch> = {}): UploadBatch => ({
  id,
  sourceType: '승인내역',
  cardIssuer: '국민',
  periodStart: '2026-01-01',
  periodEnd: '2026-03-05',
  transactionCount: 10,
  skippedDuplicateCount: 0,
  classificationPendingCount: 0,
  createdAt: '2026-11-06T05:32:00Z',
  ...overrides
});

const pageOf = (items: UploadBatch[]) => ({
  items,
  page: { number: 0, size: 20, totalElements: items.length, totalPages: 1, hasNext: false }
});

let root: Root;
let container: HTMLDivElement;

const render = async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Uploads />
      </MemoryRouter>
    );
  });
};

/** 표는 좁은 화면용과 넓은 화면용 버튼을 둘 다 그린다. 첫 것을 누른다 */
const click = async (label: string) => {
  const button = [...document.querySelectorAll('button')].find(
    (element) => element.textContent === label || element.getAttribute('aria-label') === label
  );
  if (!button) throw new Error(`${label} 버튼이 없다`);
  await act(async () => {
    button.click();
  });
};

const dialogOpen = () => document.body.textContent?.includes('이 업로드를 지울까요?') ?? false;

beforeEach(() => {
  session.batchId = 'kb';
  session.setBatchId.mockReset();
  session.reloadBatch.mockReset();
  uploads.list.mockReset();
  uploads.remove.mockReset();
  uploads.list.mockResolvedValue(pageOf([batch('kb'), batch('ibk', { cardIssuer: '기업', transactionCount: 19 })]));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const KB_DELETE = 'KB국민카드 승인내역 2026. 01. 01 – 2026. 03. 05 업로드 삭제';
const IBK_DELETE = 'IBK기업은행 승인내역 2026. 01. 01 – 2026. 03. 05 업로드 삭제';

describe('업로드 이력', () => {
  it('파일 이름을 화면마다 같은 이름으로, 올린 시각까지 보여 준다 (C59·C92)', async () => {
    await render();
    const text = container.textContent ?? '';
    expect(text).toContain('KB국민카드 승인내역');
    expect(text).toContain('IBK기업은행 승인내역');
    expect(text).toContain('2026. 11. 06 14:32');
    expect(text).not.toContain('기업카드');
    expect(text).not.toMatch(/[·・•「」『』]/);
  });

  it('보던 업로드를 지우면 남은 것 가운데서 다시 고른다 (C55)', async () => {
    uploads.remove.mockResolvedValue(undefined);
    await render();
    await click(KB_DELETE);
    expect(dialogOpen()).toBe(true);
    await click('지우기');

    expect(uploads.remove).toHaveBeenCalledWith('kb');
    expect(session.setBatchId).toHaveBeenCalledWith(null);
    expect(session.reloadBatch).toHaveBeenCalledTimes(1);
    expect(dialogOpen()).toBe(false);
    expect(uploads.list).toHaveBeenCalledTimes(2);
  });

  it('다른 업로드를 지우면 보던 것은 그대로 둔다', async () => {
    uploads.remove.mockResolvedValue(undefined);
    await render();
    await click(IBK_DELETE);
    await click('지우기');

    expect(uploads.remove).toHaveBeenCalledWith('ibk');
    expect(session.setBatchId).not.toHaveBeenCalled();
    expect(session.reloadBatch).not.toHaveBeenCalled();
    expect(dialogOpen()).toBe(false);
  });

  it('응답을 못 받은 삭제를 다시 눌러 404 가 오면 지워진 것으로 본다 (C50)', async () => {
    uploads.remove.
    mockRejectedValueOnce(
      new ApiRequestError(0, 'NETWORK_ERROR', '서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.')
    ).
    mockRejectedValueOnce(new ApiRequestError(404, 'BATCH_NOT_FOUND', '업로드를 찾을 수 없습니다.'));
    await render();
    await click(KB_DELETE);

    await click('지우기');
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('서버에 연결하지 못했습니다');
    expect(dialogOpen()).toBe(true);
    expect(session.setBatchId).not.toHaveBeenCalled();

    await click('지우기');
    expect(dialogOpen()).toBe(false);
    expect(document.body.textContent).not.toContain('업로드를 찾을 수 없습니다');
    expect(session.setBatchId).toHaveBeenCalledWith(null);
    expect(session.reloadBatch).toHaveBeenCalledTimes(1);
  });

  it('다른 실패는 창 안에 알리고 고른 업로드를 건드리지 않는다', async () => {
    uploads.remove.mockRejectedValue(new ApiRequestError(500, 'INTERNAL_ERROR', '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    await render();
    await click(KB_DELETE);
    await click('지우기');

    expect(dialogOpen()).toBe(true);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('요청을 처리하지 못했습니다');
    expect(session.setBatchId).not.toHaveBeenCalled();
    expect(session.reloadBatch).not.toHaveBeenCalled();
  });
});
