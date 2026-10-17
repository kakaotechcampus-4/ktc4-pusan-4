import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { httpApi } from './http';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ items: [], page: {} }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
};

describe('httpApi', () => {
  it('판정 이력을 읽을 때 latestOnly=false 를 보낸다 (#132)', async () => {
    await httpApi.judgments.list({ transactionId: 't1', latestOnly: false, size: 20 });
    const { searchParams } = new URL(lastCall().url, 'http://localhost');
    expect(searchParams.get('latestOnly')).toBe('false');
    expect(searchParams.get('transactionId')).toBe('t1');
  });

  it('사용자 수정에 Idempotency-Key 를 붙인다 (#62)', async () => {
    await httpApi.judgments.override('j1', { toVerdict: 'AVAILABLE', reason: '업무' }, 'key-1');
    const { url, init, headers } = lastCall();
    expect(url).toBe('/api/v1/judgments/j1/override');
    expect(init.method).toBe('POST');
    expect(headers['Idempotency-Key']).toBe('key-1');
    expect(JSON.parse(init.body as string)).toEqual({ toVerdict: 'AVAILABLE', reason: '업무' });
  });
});
