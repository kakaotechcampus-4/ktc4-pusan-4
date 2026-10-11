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
 * 1.3 에러 응답(`{code, message, traceId}`)을 그대로 ApiRequestError 로 올린다.
 * traceId 를 버리지 않는다 — 서버 로그와 맞춰 봐야 할 때 이것 하나로 찾는다.
 */
async function request<T>(
method: string,
path: string,
options: Options = {})
: Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

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

  if (!response.ok) {
    const error = (data ?? {}) as { code?: string; message?: string; traceId?: string };
    throw new ApiRequestError(
      response.status,
      error.code ?? 'UNKNOWN',
      error.message ?? `요청을 처리하지 못했습니다. (${response.status})`,
      error.traceId ?? ''
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
    create: (body) => post('/upload-batches', body, crypto.randomUUID()),
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
      verdict: query?.verdict
    }),
    get: (judgmentId) => get(`/judgments/${judgmentId}`),
    override: (judgmentId, body) => post(`/judgments/${judgmentId}/override`, body),
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
    bulkAnswer: (body) => post('/questions/bulk-answer', body)
  }
};
