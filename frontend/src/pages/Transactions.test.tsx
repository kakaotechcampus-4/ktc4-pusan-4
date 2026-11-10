// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionQuery } from '../api/contract';
import type { BatchStatus } from '../contexts/SessionContext';
import type { ClassificationStatus, EffectiveStatus, Transaction } from '../types/domain';
import { Transactions } from './Transactions';

const { session, transactions, uploads } = vi.hoisted(() => ({
  session: {
    batchId: null as string | null,
    batchStatus: 'ready' as BatchStatus,
    reloadBatch: vi.fn()
  },
  transactions: { list: vi.fn(), include: vi.fn(), exclude: vi.fn() },
  uploads: { get: vi.fn() }
}));

vi.mock('../contexts/SessionContext', () => ({ useSession: () => session }));
vi.mock('../components/AppShell', () => ({
  AppShell: ({ children }: {children: React.ReactNode;}) => <>{children}</>
}));
vi.mock('../api', async () => ({
  api: { transactions, uploads },
  useApi: (await import('../api/hooks')).useApi,
  ApiRequestError: (await import('../api/contract')).ApiRequestError
}));

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean;}).IS_REACT_ACT_ENVIRONMENT = true;

const LABEL: Record<EffectiveStatus, string> = {
  JUDGEABLE: '판정대상',
  EXCLUDED: '대상제외',
  CANCELED_OFFSET: '취소상계'
};

const row = (
id: string,
merchant: string,
effective: EffectiveStatus,
classification: ClassificationStatus)
: Transaction => ({
  id,
  batchId: 'kb',
  approvedAt: '2026-02-03',
  merchantRaw: merchant,
  merchantNorm: merchant,
  merchantCategory: classification === 'CLASSIFIED' ? '카페' : '미분류',
  classificationStatus: { code: classification, label: '분류 확인 필요' },
  amount: 99_000,
  installmentMonths: 0,
  sourceStatus: { code: effective, label: LABEL[effective] },
  userInclusion: 'AUTO',
  effectiveStatus: { code: effective, label: LABEL[effective] }
});

const ROWS = [
row('1', '스타벅스', 'JUDGEABLE', 'CLASSIFIED'),
row('2', '온새미로공방', 'JUDGEABLE', 'NEEDS_REVIEW'),
row('3', '포인트사용', 'EXCLUDED', 'NEEDS_REVIEW')];


const pageOf = (items: Transaction[], totalElements = items.length) => ({
  items,
  page: { number: 0, size: 20, totalElements, totalPages: 1, hasNext: false }
});

/** 서버처럼 상태와 달로 거른다. 이 데이터는 모두 2월이다 */
const serve = async (query: TransactionQuery = {}) => {
  const items = ROWS.filter(
    (item) =>
    (!query.status || item.effectiveStatus.code === query.status) && (!query.month || query.month === 2)
  );
  return query.size === 1 ? pageOf(items.slice(0, 1), items.length) : pageOf(items);
};

let root: Root;
let container: HTMLDivElement;

const render = async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Transactions />
      </MemoryRouter>
    );
  });
};

const buttons = () => [...container.querySelectorAll('button')];
const click = async (label: string) => {
  const button = buttons().find((element) => element.textContent === label);
  if (!button) throw new Error(`${label} 버튼이 없다`);
  await act(async () => {
    button.click();
  });
};
const rowOf = (merchant: string) =>
[...container.querySelectorAll('tbody tr')].find((tr) => tr.textContent?.includes(merchant));

beforeEach(() => {
  session.batchId = 'kb';
  session.batchStatus = 'ready';
  session.reloadBatch.mockReset();
  transactions.list.mockReset();
  transactions.list.mockImplementation(serve);
  uploads.get.mockResolvedValue({ id: 'kb', periodStart: '2026-01-01', periodEnd: '2026-02-28' });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('거래', () => {
  it('탭마다 서버가 센 건수를 붙인다 (C97)', async () => {
    await render();
    const tabs = [...container.querySelectorAll('[aria-label="판정대상 상태"] button')].map((button) => button.textContent);
    expect(tabs).toEqual(['전체3', '판정대상2', '대상제외1', '취소상계0']);
  });

  it('분류 필요는 분류 확인이 기다리는 판정 대상 거래에만 붙는다 (C108)', async () => {
    await render();
    expect(rowOf('온새미로공방')?.textContent).toContain('분류 필요');
    expect(rowOf('포인트사용')?.textContent).not.toContain('분류');
    expect(container.textContent).not.toContain('분류 확인 필요');
  });

  it('조건에 맞는 거래가 없으면 올리기가 아니라 필터 초기화를 권한다 (C97)', async () => {
    await render();
    await click('취소상계0');
    expect(container.textContent).toContain('이 조건에 맞는 거래가 없습니다');
    expect(container.textContent).not.toContain('카드내역 올리기');

    await click('필터 초기화');
    expect(rowOf('스타벅스')).toBeDefined();
    expect(container.querySelector('[aria-label="판정대상 상태"] [aria-pressed="true"]')?.textContent).toBe('전체3');
  });

  it('달은 업로드 기간에 든 달만 고르고, 고르면 그 해와 달로 묻는다', async () => {
    await render();
    const months = [...container.querySelectorAll('[aria-label="달"] button')].map((button) => button.textContent);
    expect(months).toEqual(['전체 기간', '1월', '2월']);
    await click('2월');
    expect(transactions.list).toHaveBeenLastCalledWith(expect.objectContaining({ year: 2026, month: 2 }));
  });

  it('상태 배지는 판정대상이 아닌 행에만 달고, 바꾸는 버튼은 모든 행에 둔다', async () => {
    await render();
    expect(rowOf('스타벅스')?.textContent).not.toContain('판정대상');
    const action = (merchant: string) => rowOf(merchant)?.querySelector('button[aria-label]')?.getAttribute('aria-label');
    expect(action('스타벅스')).toContain('판정 대상에서 빼기');
    expect(rowOf('포인트사용')?.textContent).toContain('대상제외');
    expect(action('포인트사용')).toContain('판정 대상에 다시 넣기');
  });

  it('빼기는 확인 창에서 한 번 더 묻고, 다시 넣기는 묻지 않는다 (11/8 회의)', async () => {
    transactions.exclude.mockReset().mockResolvedValue({});
    transactions.include.mockReset().mockResolvedValue({});
    await render();
    const press = async (button: Element | null | undefined) => {
      if (!(button instanceof HTMLElement)) throw new Error('버튼이 없다');
      await act(async () => {
        button.click();
      });
    };
    const dialog = () => document.body.querySelector('[role="dialog"]');
    const dialogButton = (label: string) =>
    [...(dialog()?.querySelectorAll('button') ?? [])].find((button) => button.textContent === label);

    await press(rowOf('스타벅스')?.querySelector('button[aria-label]'));
    expect(dialog()?.textContent).toContain('판정 대상에서 뺄까요?');
    expect(dialog()?.textContent).toContain('스타벅스');
    expect(transactions.exclude).not.toHaveBeenCalled();

    await press(dialogButton('취소'));
    expect(dialog()).toBeNull();
    expect(transactions.exclude).not.toHaveBeenCalled();

    await press(rowOf('스타벅스')?.querySelector('button[aria-label]'));
    await press(dialogButton('빼기'));
    expect(transactions.exclude).toHaveBeenCalledWith('1');
    expect(dialog()).toBeNull();

    await press(rowOf('포인트사용')?.querySelector('button[aria-label]'));
    expect(dialog()).toBeNull();
    expect(transactions.include).toHaveBeenCalledWith('3');
  });

  it('빼지 못하면 확인 창 안에 까닭을 보인다', async () => {
    const { ApiRequestError } = await import('../api/contract');
    transactions.exclude.mockReset().mockRejectedValue(
      new ApiRequestError(500, 'INTERNAL', '서버가 잠시 멈췄습니다.')
    );
    await render();
    await act(async () => {
      (rowOf('스타벅스')?.querySelector('button[aria-label]') as HTMLElement).click();
    });
    await act(async () => {
      [...document.body.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent === '빼기')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.querySelector('[role="dialog"] [role="alert"]')?.textContent).toBe('서버가 잠시 멈췄습니다.');
  });

  it('올린 파일이 없으면 올리기를 권하고 거래를 묻지 않는다', async () => {
    session.batchId = null;
    await render();
    expect(container.textContent).toContain('아직 올린 카드내역이 없습니다');
    expect(container.querySelector('a[href="/upload"]')?.textContent).toBe('카드내역 올리기');
    expect(transactions.list).not.toHaveBeenCalled();
  });

  it('업로드를 고르는 중에는 비었다고 말하지 않는다', async () => {
    session.batchId = null;
    session.batchStatus = 'loading';
    await render();
    expect(container.textContent).not.toContain('없습니다');
  });

  it('가맹점은 카드에 찍힌 이름으로 쓰고 가린 의료기관 토큰은 보이지 않는다', async () => {
    const medical = { ...row('9', '의료_마스킹_01', 'JUDGEABLE', 'CLASSIFIED'), merchantNorm: '의료_마스킹_01' };
    const spaced = { ...row('8', 'FIGMA.COM', 'JUDGEABLE', 'CLASSIFIED'), merchantNorm: 'FIGMACOM' };
    transactions.list.mockResolvedValue(pageOf([medical, spaced]));
    await render();
    expect(container.textContent).toContain('의료기관 (이름 가림)');
    expect(container.textContent).not.toContain('의료_마스킹');
    expect(container.textContent).toContain('FIGMA.COM');
    expect(container.textContent).not.toContain('FIGMACOM');
  });

  it('화면 문구에 가운뎃점과 낫표가 없다', async () => {
    await render();
    expect(container.textContent).not.toMatch(/[·・•「」『』]/);
  });
});
