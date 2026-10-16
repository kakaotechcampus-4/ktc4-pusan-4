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

describe('인증 (#139 가정)', () => {
  /** 경로마다 응답을 정한다. 함수면 부를 때마다 새로 만든다(본문은 한 번만 읽힌다) */
  const route = (table: Record<string, (init: RequestInit) => [number, unknown?]>) =>
  fetchMock.mockImplementation((url: string, init: RequestInit) => {
    const path = url.replace('/api/v1', '').split('?')[0];
    const [status, body] = table[path]?.(init) ?? [404];
    return Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));
  });
  const bearer = (init: RequestInit) => (init.headers as Record<string, string>).Authorization;
  const callsTo = (path: string) =>
  fetchMock.mock.calls.filter(([url]) => String(url).split('?')[0] === `/api/v1${path}`);

  // 토큰은 모듈 안에 있다. 테스트마다 새로 읽는다
  const fresh = async () => {
    vi.resetModules();
    return (await import('./http')).httpApi;
  };

  it('로그인한 토큰을 헤더에 싣고, 로그인 요청에는 싣지 않는다', async () => {
    const api = await fresh();
    route({ '/auth/login': () => [200, { accessToken: 'a1' }], '/users/me': () => [200, { id: 'u' }] });
    await api.auth.login({ email: 'a@b.c', password: 'secret1' });
    await api.users.me();
    expect(bearer(callsTo('/auth/login')[0][1])).toBeUndefined();
    expect(bearer(callsTo('/users/me')[0][1])).toBe('Bearer a1');
  });

  it('401 이면 한 번 재발급하고 같은 요청을 다시 보낸다. 동시에 받은 401 도 재발급은 한 번이다', async () => {
    const api = await fresh();
    let refreshed = false;
    route({
      '/auth/login': () => [200, { accessToken: 'old' }],
      '/auth/refresh': () => {
        refreshed = true;
        return [200, { accessToken: 'new' }];
      },
      '/users/me': (init) => bearer(init) === 'Bearer new' ? [200, { id: 'u' }] : [401, { code: 'UNAUTHORIZED' }],
      '/users/me/contexts': (init) => bearer(init) === 'Bearer new' ? [200, []] : [401, { code: 'UNAUTHORIZED' }]
    });
    await api.auth.login({ email: 'a@b.c', password: 'secret1' });
    await Promise.all([api.users.me(), api.contexts.list()]);
    expect(refreshed).toBe(true);
    expect(callsTo('/auth/refresh')).toHaveLength(1);
    expect(callsTo('/users/me').map(([, init]) => bearer(init))).toEqual(['Bearer old', 'Bearer new']);
  });

  it('재발급도 401 이면 로그인이 풀렸다고 한 번만 알린다', async () => {
    const api = await fresh();
    const lost = vi.fn();
    api.auth.onLost(lost);
    route({
      '/auth/login': () => [200, { accessToken: 'old' }],
      '/auth/refresh': () => [401, { code: 'UNAUTHORIZED' }],
      '/users/me': () => [401, { code: 'UNAUTHORIZED' }],
      '/users/me/contexts': () => [401, { code: 'UNAUTHORIZED' }]
    });
    await api.auth.login({ email: 'a@b.c', password: 'secret1' });
    const results = await Promise.allSettled([api.users.me(), api.contexts.list()]);
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    expect(lost).toHaveBeenCalledTimes(1);
  });

  it('로그인이 401 이면 재발급하지 않고 그대로 던진다', async () => {
    const api = await fresh();
    route({ '/auth/login': () => [401, { code: 'UNAUTHORIZED', message: 'x' }] });
    await expect(api.auth.login({ email: 'a@b.c', password: 'wrong12' })).rejects.toMatchObject({ status: 401 });
    expect(callsTo('/auth/refresh')).toHaveLength(0);
  });

  it('새로고침 뒤 이어 가기에 실패해도 로그인이 풀렸다고 알리지 않는다', async () => {
    const api = await fresh();
    const lost = vi.fn();
    api.auth.onLost(lost);
    route({ '/auth/refresh': () => [401, { code: 'UNAUTHORIZED' }] });
    expect(await api.auth.restore()).toBe(false);
    expect(lost).not.toHaveBeenCalled();
  });

  it('로그아웃은 토큰을 실어 보내고, 바로 지운다', async () => {
    const api = await fresh();
    route({
      '/auth/login': () => [200, { accessToken: 'a1' }],
      '/auth/logout': () => [204],
      '/users/me': () => [401, { code: 'UNAUTHORIZED' }]
    });
    await api.auth.login({ email: 'a@b.c', password: 'secret1' });
    const sent = api.auth.logout();
    await expect(api.users.me()).rejects.toMatchObject({ status: 401 });
    await sent;
    expect(bearer(callsTo('/auth/logout')[0][1])).toBe('Bearer a1');
    // 지운 뒤라 토큰 없이 갔고, 토큰이 없으니 재발급도 하지 않는다
    expect(bearer(callsTo('/users/me')[0][1])).toBeUndefined();
    expect(callsTo('/auth/refresh')).toHaveLength(0);
  });
});
