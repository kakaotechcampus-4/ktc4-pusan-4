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

  it('세무대리인 질문 저장 API 가 없으면(404) 저장한 질문이 없는 것으로 읽는다', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'NOT_FOUND' }), { status: 404 }));
    await expect(httpApi.handoffNotes.list()).resolves.toEqual([]);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'INTERNAL_ERROR' }), { status: 500 }));
    await expect(httpApi.handoffNotes.list()).rejects.toMatchObject({ status: 500 });
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

  it('재발급이 401 이 아닌 이유로 실패하면 로그인을 지우지 않고 그 오류를 올린다', async () => {
    const api = await fresh();
    const lost = vi.fn();
    api.auth.onLost(lost);
    let refreshStatus = 503;
    route({
      '/auth/login': () => [200, { accessToken: 'a1' }],
      '/auth/refresh': () => [refreshStatus, refreshStatus === 200 ? { accessToken: 'a2' } : { code: 'SERVICE_UNAVAILABLE' }],
      '/users/me': (init) => bearer(init) === 'Bearer a2' ? [200, { id: 'u' }] : [401, { code: 'UNAUTHORIZED' }]
    });
    await api.auth.login({ email: 'a@b.c', password: 'secret1' });
    await expect(api.users.me()).rejects.toMatchObject({ status: 503 });
    expect(lost).not.toHaveBeenCalled();

    // 토큰을 그대로 두었으니 다음 요청이 다시 재발급하고 이어 간다
    refreshStatus = 200;
    await expect(api.users.me()).resolves.toEqual({ id: 'u' });
    expect(bearer(callsTo('/users/me')[1][1])).toBe('Bearer a1');
    expect(callsTo('/auth/refresh')).toHaveLength(2);
  });

  it('새로고침 뒤 이어 가기는 어떤 실패든 false 다', async () => {
    const api = await fresh();
    route({ '/auth/refresh': () => [503, { code: 'SERVICE_UNAVAILABLE' }] });
    expect(await api.auth.restore()).toBe(false);
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await api.auth.restore()).toBe(false);
  });

  it('다른 계정 로그인이 실패하면 앞 사람의 토큰도 남지 않는다', async () => {
    const api = await fresh();
    let loginStatus = 200;
    route({
      '/auth/login': () => loginStatus === 200 ? [200, { accessToken: 'a1' }] : [401, { code: 'INVALID_CREDENTIALS' }],
      '/users/me': () => [200, { id: 'u' }]
    });
    await api.auth.login({ email: 'a@b.c', password: 'secret1' });
    loginStatus = 401;
    await expect(api.auth.login({ email: 'b@b.c', password: 'wrong12' })).rejects.toMatchObject({ status: 401 });
    await api.users.me();
    expect(bearer(callsTo('/users/me')[0][1])).toBeUndefined();
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

  describe('재발급이 로그인·로그아웃과 겹칠 때', () => {
    /** 재발급 응답을 붙잡아 두고, 원하는 때 내보낸다 */
    const holdRefresh = () => {
      let release: (status: number, body: unknown) => void = () => undefined;
      const order: string[] = [];
      const respond = (status: number, body?: unknown) =>
      new Response(body === undefined ? null : JSON.stringify(body), { status });
      fetchMock.mockImplementation((url: string, init: RequestInit) => {
        const path = url.replace('/api/v1', '').split('?')[0];
        order.push(path);
        if (path === '/auth/refresh')
        return new Promise<Response>((resolve) => {
          release = (status, body) => {
            order.push('refresh 응답');
            resolve(respond(status, body));
          };
        });
        if (path === '/auth/login') {
          const { email } = JSON.parse(init.body as string) as { email: string };
          return Promise.resolve(respond(200, { accessToken: email === 'b@b.c' ? 'b1' : 'a1' }));
        }
        if (path === '/auth/logout') return Promise.resolve(respond(204));
        // 'b1' 만 통하는 서버. 그 밖의 토큰은 만료됐다
        return Promise.resolve(bearer(init) === 'Bearer b1' ? respond(200, { id: 'b' }) : respond(401, { code: 'UNAUTHORIZED' }));
      });
      return { release: (status: number, body?: unknown) => release(status, body), order };
    };
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

    it('로그아웃하면 늦게 온 재발급 토큰을 쓰지 않고, 로그아웃은 재발급이 끝난 뒤에 보낸다', async () => {
      const api = await fresh();
      const held = holdRefresh();
      await api.auth.login({ email: 'a@b.c', password: 'secret1' });
      const me = api.users.me();
      await flush();
      const out = api.auth.logout();
      held.release(200, { accessToken: 'a2' });
      await expect(me).rejects.toMatchObject({ status: 401 });
      await out;
      // 쿠키를 지우는 응답이 재발급의 Set-Cookie 보다 뒤에 오도록 순서를 지킨다
      expect(held.order.indexOf('refresh 응답')).toBeLessThan(held.order.indexOf('/auth/logout'));
      expect(bearer(callsTo('/auth/logout')[0][1])).toBeUndefined();
      await api.users.me().catch(() => undefined);
      expect(bearer(callsTo('/users/me').slice(-1)[0][1])).toBeUndefined();
    });

    it('다른 계정으로 로그인하면 앞 사람의 재발급 토큰이 새 토큰을 덮지 않는다', async () => {
      const api = await fresh();
      const held = holdRefresh();
      await api.auth.login({ email: 'a@b.c', password: 'secret1' });
      const me = api.users.me();
      await flush();
      const login = api.auth.login({ email: 'b@b.c', password: 'secret1' });
      await flush();
      // 앞 재발급이 끝나기 전에는 로그인을 보내지 않는다
      expect(callsTo('/auth/login')).toHaveLength(1);
      held.release(200, { accessToken: 'a2' });
      await login;
      // 앞 사람의 요청은 새 토큰으로 다시 보내지 않는다
      await expect(me).rejects.toMatchObject({ status: 401 });
      expect(callsTo('/users/me')).toHaveLength(1);
      await expect(api.users.me()).resolves.toEqual({ id: 'b' });
      expect(bearer(callsTo('/users/me').slice(-1)[0][1])).toBe('Bearer b1');
    });

    it('앞 세션의 재발급이 401 이어도 새 로그인을 풀지 않는다', async () => {
      const api = await fresh();
      const lost = vi.fn();
      api.auth.onLost(lost);
      const held = holdRefresh();
      await api.auth.login({ email: 'a@b.c', password: 'secret1' });
      const me = api.users.me();
      await flush();
      const login = api.auth.login({ email: 'b@b.c', password: 'secret1' });
      held.release(401, { code: 'INVALID_REFRESH_TOKEN' });
      await login;
      await expect(me).rejects.toMatchObject({ status: 401 });
      expect(lost).not.toHaveBeenCalled();
      await expect(api.users.me()).resolves.toEqual({ id: 'b' });
    });

    it('이미 바뀐 토큰으로 보낸 요청의 늦은 401 은 재발급 없이 새 토큰으로 다시 보낸다', async () => {
      const api = await fresh();
      const respond = (status: number, body?: unknown) =>
      new Response(body === undefined ? null : JSON.stringify(body), { status });
      let releaseSlow: () => void = () => undefined;
      fetchMock.mockImplementation((url: string, init: RequestInit) => {
        const path = url.replace('/api/v1', '').split('?')[0];
        if (path === '/auth/login') return Promise.resolve(respond(200, { accessToken: 'old' }));
        if (path === '/auth/refresh') return Promise.resolve(respond(200, { accessToken: 'new' }));
        const ok = bearer(init) === 'Bearer new';
        // 옛 토큰으로 보낸 /users/me/contexts 의 401 만 늦게 온다
        if (path === '/users/me/contexts' && !ok)
        return new Promise<Response>((resolve) => {
          releaseSlow = () => resolve(respond(401, { code: 'UNAUTHORIZED' }));
        });
        return Promise.resolve(ok ? respond(200, path === '/users/me' ? { id: 'u' } : []) : respond(401, { code: 'UNAUTHORIZED' }));
      });
      await api.auth.login({ email: 'a@b.c', password: 'secret1' });
      const slow = api.contexts.list();
      await api.users.me();
      releaseSlow();
      await expect(slow).resolves.toEqual([]);
      expect(callsTo('/auth/refresh')).toHaveLength(1);
    });

    it('이어 가기가 끝나기 전에 로그인하면 이어 가기는 false 다', async () => {
      const api = await fresh();
      const held = holdRefresh();
      const restored = api.auth.restore();
      await flush();
      const login = api.auth.login({ email: 'b@b.c', password: 'secret1' });
      held.release(200, { accessToken: 'a2' });
      expect(await restored).toBe(false);
      await login;
      await expect(api.users.me()).resolves.toEqual({ id: 'b' });
    });
  });
});
