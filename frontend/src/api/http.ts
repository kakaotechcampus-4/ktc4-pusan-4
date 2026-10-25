import { ApiRequestError } from './contract';
import type { Api } from './contract';

/**
 * 실제 서버 구현. 배포에서 Caddy 가 `/api/v1/*` 를 백엔드로 넘기므로(deploy/Caddyfile)
 * 같은 오리진이고 CORS 가 없다. 개발 중에는 vite proxy 가 같은 경로를 넘긴다.
 */
const BASE = '/api/v1';

type Query = Record<string, string | number | boolean | undefined | null>;

const qs = (query?: Query) => {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
};

interface Options {
  query?: Query;
  body?: unknown;
  /** 1.6 업로드처럼 재전송돼도 한 번만 처리돼야 하는 요청 */
  idempotencyKey?: string;
}

/**
 * 인증 (#139 가정). 액세스 토큰은 메모리에만 두고 Authorization 헤더로 보낸다.
 * 리프레시 토큰은 서버가 httpOnly 쿠키로 둔다 — 같은 오리진이라 fetch 가 그대로 실어 보낸다.
 * 경로와 응답 모양(`{accessToken}`)은 api.md 에 적히면 맞춘다.
 */
let accessToken: string | null = null;
const lostListeners = new Set<() => void>();

/** 로그인·재발급은 만료된 토큰을 싣지 않는다. 서버가 헤더의 토큰부터 검사하면 거기서 401 이 난다 */
const NO_BEARER = new Set(['/auth/login', '/auth/refresh']);
/** 이 경로의 401 은 재발급으로 풀리지 않는다 */
const isAuthPath = (path: string) => path.startsWith('/auth/');

/**
 * 로그인·로그아웃·풀림마다 올린다. 그 전에 시작한 재발급·재시도의 결과는 지금 세션에 쓰지 않는다 —
 * 늦게 온 재발급이 로그아웃한 토큰을 되살리거나 다른 계정의 토큰을 덮고, 지난 세션의 401 이 새 로그인을 풀 수 있다
 */
let generation = 0;

/** 로그인이 풀렸다. 토큰이 있던 경우에만 한 번 알린다 — 동시에 실패한 요청이 여러 번 알리지 않게 */
const lose = () => {
  if (accessToken === null) return;
  accessToken = null;
  generation += 1;
  lostListeners.forEach((listener) => listener());
};

let refreshing: Promise<void> | null = null;
/**
 * 동시에 401 을 받은 요청들이 재발급을 한 번만 하도록 진행 중인 재발급을 나눠 쓴다.
 * 실패하면 그 오류로 거절한다. 401 이 아닌 실패(5xx·연결 끊김)는 리프레시 쿠키가 멀쩡할 수 있다
 */
const refresh = () => {
  if (!refreshing) {
    const startedAt = generation;
    refreshing = request<{ accessToken: string }>('POST', '/auth/refresh').
    then((result) => {
      if (generation === startedAt) accessToken = result.accessToken;
    }).
    finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
};

/**
 * 진행 중인 재발급이 끝날 때까지 기다린다. 재발급 응답의 Set-Cookie 가 로그인·로그아웃 응답보다
 * 늦게 오면 지난 세션의 리프레시 쿠키가 남아, 새로고침하면 그 세션으로 돌아간다
 */
const settled = () => refreshing?.then(() => undefined, () => undefined);

/**
 * 1.3 에러 응답(`{code, message, traceId}`)을 그대로 ApiRequestError 로 올린다.
 * traceId 를 버리지 않는다 — 서버 로그와 맞춰 봐야 할 때 이것 하나로 찾는다.
 * 401 이면 재발급을 한 번 해 보고 같은 요청(같은 Idempotency-Key)을 다시 보낸다. 그것도 안 되면 로그인이 풀린다.
 */
async function request<T>(
method: string,
path: string,
options: Options = {},
retried = false)
: Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
  const sentToken = NO_BEARER.has(path) ? null : accessToken;
  const sentAt = generation;
  if (sentToken) headers.Authorization = `Bearer ${sentToken}`;

  let response: Response;
  try {
    response = await fetch(BASE + path + qs(options.query), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch {
    // 네트워크가 끊겼거나 서버가 응답하지 않는다. 화면이 "데이터 없음"으로 읽지 않도록 상태 0 으로 구분한다
    throw new ApiRequestError(0, 'NETWORK_ERROR', '서버에 연결하지 못했습니다.');
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  // 그사이 로그인·로그아웃했으면 지난 세션의 요청이다. 다시 보내지도, 지금 로그인을 풀지도 않고 그 401 을 올린다
  if (response.status === 401 && !retried && !isAuthPath(path) && sentToken !== null && generation === sentAt) {
    // 다른 요청이 이미 재발급했으면 새 토큰으로 다시 보내기만 한다
    const refreshed =
    accessToken !== sentToken ||
    await refresh().then(
      () => true,
      (caught: unknown) => {
        // 재발급도 401 이면 로그인이 풀렸다. 그 밖의 실패는 토큰을 두고 그 오류를 올린다 — 다음 요청이 다시 재발급한다
        if (!(caught instanceof ApiRequestError && caught.status === 401)) throw caught;
        return false;
      }
    );
    if (generation === sentAt) {
      if (refreshed) return request<T>(method, path, options, true);
      lose();
    }
  }

  if (!response.ok) {
    const error = (data ?? {}) as { code?: string; message?: string; traceId?: string };
    // 초 단위만 읽는다. 날짜 형식이면 버린다
    const retryAfter = Number(response.headers.get('Retry-After'));
    throw new ApiRequestError(
      response.status,
      error.code ?? 'UNKNOWN',
      error.message ?? `요청을 처리하지 못했습니다. (${response.status})`,
      error.traceId ?? '',
      response.headers.has('Retry-After') && Number.isFinite(retryAfter) ? retryAfter : undefined
    );
  }
  return data as T;
}

const get = <T,>(path: string, query?: Query) => request<T>('GET', path, { query });
const post = <T,>(path: string, body?: unknown, idempotencyKey?: string) =>
request<T>('POST', path, { body, idempotencyKey });
const del = (path: string) => request<void>('DELETE', path);

/** 응답에서 쓰지 않는 쿼리 값을 거르지 않고 그대로 넘긴다. 서버가 계약의 주인이다 */
const page = (query?: { page?: number; size?: number }): Query => ({
  page: query?.page,
  size: query?.size
});

export const httpApi: Api = {
  auth: {
    login: async (body) => {
      // 다른 계정으로 로그인하다 실패해도 앞 사람의 토큰이 남지 않게 먼저 버린다
      accessToken = null;
      generation += 1;
      await settled();
      const startedAt = generation;
      const result = await post<{ accessToken: string }>('/auth/login', body);
      // 그사이 로그아웃했거나 다시 로그인했으면 이 토큰은 쓰지 않는다
      if (generation === startedAt) accessToken = result.accessToken;
    },
    // 아직 로그인 전이라 잃을 것이 없다. 어떤 이유로든 못 이어 가면 로그인 화면이다
    restore: () => {
      const startedAt = generation;
      return refresh().then(() => generation === startedAt, () => false);
    },
    logout: async () => {
      generation += 1;
      if (refreshing) {
        // 재발급이 끝난 뒤에 보낸다(settled). 토큰은 싣지 않는다 — /auth/* 는 토큰을 보지 않고 쿠키만 지운다
        accessToken = null;
        await settled();
        return post<void>('/auth/logout');
      }
      // 헤더는 부르는 순간 만들어지므로 토큰을 실은 채로 보내고, 기다리지 않고 바로 지운다
      const sent = post<void>('/auth/logout');
      accessToken = null;
      return sent;
    },
    onLost: (listener) => {
      lostListeners.add(listener);
      return () => {
        lostListeners.delete(listener);
      };
    }
  },

  users: {
    me: () => get('/users/me'),
    remove: () => del('/users/me')
  },

  contexts: {
    create: (body) => post('/users/me/contexts', body),
    /** 문진 전이면 404 다. 그건 오류가 아니라 "아직 없음"이므로 null 로 바꾼다 (3.2) */
    current: () =>
    get<ReturnType<Api['contexts']['current']> extends Promise<infer R> ? R : never>(
      '/users/me/contexts/current'
    ).catch((caught: unknown) => {
      if (caught instanceof ApiRequestError && caught.status === 404) return null;
      throw caught;
    }),
    list: () => get('/users/me/contexts')
  },

  uploads: {
    create: (body, idempotencyKey) => post('/upload-batches', body, idempotencyKey),
    list: (query) => get('/upload-batches', page(query)),
    get: (batchId) => get(`/upload-batches/${batchId}`),
    remove: (batchId) => del(`/upload-batches/${batchId}`)
  },

  transactions: {
    list: (query) =>
    get('/transactions', {
      ...page(query),
      batchId: query?.batchId,
      year: query?.year,
      month: query?.month,
      status: query?.status,
      classificationStatus: query?.classificationStatus,
      verdict: query?.verdict
    }),
    get: (transactionId) => get(`/transactions/${transactionId}`),
    include: (transactionId) => post(`/transactions/${transactionId}/include`),
    exclude: (transactionId) => post(`/transactions/${transactionId}/exclude`)
  },

  classificationReviews: {
    list: (query) =>
    get('/classification-reviews', {
      ...page(query),
      batchId: query?.batchId,
      status: query?.status
    }),
    grouped: (query) =>
    get('/classification-reviews', {
      ...page(query),
      batchId: query?.batchId,
      status: query?.status,
      grouped: true
    }),
    respond: (body) => post('/classification-responses', body)
  },

  runs: {
    create: (body) => post('/judgment-runs', body),
    get: (runId) => get(`/judgment-runs/${runId}`),
    failures: (runId, query) => get(`/judgment-runs/${runId}/failures`, page(query))
  },

  judgments: {
    summary: (scope) =>
    get('/judgments/summary', {
      batchId: scope.batchId,
      year: scope.year,
      runId: scope.runId
    }),
    list: (query) =>
    get('/judgments', {
      ...page(query),
      batchId: query?.batchId,
      year: query?.year,
      transactionId: query?.transactionId,
      runId: query?.runId,
      verdict: query?.verdict,
      latestOnly: query?.latestOnly
    }),
    get: (judgmentId) => get(`/judgments/${judgmentId}`),
    override: (judgmentId, body, idempotencyKey) =>
    post(`/judgments/${judgmentId}/override`, body, idempotencyKey),
    removeOverride: (overrideId) => del(`/judgment-overrides/${overrideId}`)
  },

  statutes: {
    get: (statuteVersionId) => get(`/statutes/${statuteVersionId}`)
  },

  questions: {
    list: (query) =>
    get('/questions', {
      ...page(query),
      batchId: query?.batchId,
      transactionId: query?.transactionId,
      status: query?.status
    }),
    grouped: (query) =>
    get('/questions', {
      ...page(query),
      batchId: query?.batchId,
      transactionId: query?.transactionId,
      status: query?.status,
      grouped: true
    }),
    respond: (body) => post('/question-responses', body),
    bulkAnswer: (body) => post('/questions/bulk-answer', body),
    suggestions: (batchId) => get('/questions/suggestions', { batchId })
  },

  // 아래 경로는 명세 10장의 이름을 따른 가정이다. 백엔드가 정하면 맞춘다
  assistant: {
    chat: (body) => post('/assistant/chat', body)
  },

  progress: {
    get: (batchId) => get('/progress', { batchId })
  },

  handoffNotes: {
    // 저장 API 가 아직 없는 서버(404)는 저장한 질문이 없는 것과 같다. 다른 실패는 요약이 「빠진 항목」으로 알린다
    list: () =>
    get<Awaited<ReturnType<Api['handoffNotes']['list']>>>('/handoff-notes').catch((caught: unknown) => {
      if (caught instanceof ApiRequestError && caught.status === 404) return [];
      throw caught;
    }),
    create: (body) => post('/handoff-notes', body)
  },

  admin: {
    ruleCandidates: {
      list: (query) => get('/admin/rule-candidates', { ...page(query), status: query?.status }),
      approve: (candidateId) => post(`/admin/rule-candidates/${candidateId}/approve`),
      reject: (candidateId) => post(`/admin/rule-candidates/${candidateId}/reject`)
    }
  }
};
