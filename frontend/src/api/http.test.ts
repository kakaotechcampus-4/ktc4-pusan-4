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
});
