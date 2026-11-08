import { ApiRequestError, rememberTraceId } from './contract';
import type { Api } from './contract';
import type { SessionEndReason } from '../auth/session';

/**
 * 실제 서버 구현. 배포에서 Caddy 가 `/api/v1/*` 를 백엔드로 넘기므로(deploy/caddy/Caddyfile)
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
 * 인증 (api.md 1.1). 액세스 토큰은 메모리에만 두고 Authorization 헤더로 보낸다.
 * 리프레시 토큰은 서버가 httpOnly 쿠키로 둔다 — 같은 오리진이라 fetch 가 그대로 실어 보낸다.
 */
let accessToken: string | null = null;
/** 세션이 끝난 이유를 넘긴다(계약의 onLost). SessionContext 가 로그인 화면에 알린다 */
const lostListeners = new Set<(reason: SessionEndReason) => void>();

/** 로그인·가입·재발급은 만료된 토큰을 싣지 않는다. 서버가 헤더의 토큰부터 검사하면 거기서 401 이 난다 */
const NO_BEARER = new Set([
'/auth/login',
'/auth/refresh',
'/auth/signup',
'/auth/kakao',
'/auth/email-verification',
'/auth/email-verification/confirm',
'/auth/password-reset',
'/auth/password-reset/confirm',
'/auth/password-reset/complete']
);
/** 이 경로의 401 은 재발급으로 풀리지 않는다 */
const isAuthPath = (path: string) => path.startsWith('/auth/');

/**
 * 로그인·로그아웃·풀림마다 올린다. 그 전에 시작한 재발급·재시도의 결과는 지금 세션에 쓰지 않는다 —
 * 늦게 온 재발급이 로그아웃한 토큰을 되살리거나 다른 계정의 토큰을 덮고, 지난 세션의 401 이 새 로그인을 풀 수 있다
 */
let generation = 0;

/** 로그인이 풀렸다. 토큰이 있던 경우에만 한 번 알린다 — 동시에 실패한 요청이 여러 번 알리지 않게 */
const lose = (reason: SessionEndReason) => {
  if (accessToken === null) return;
  accessToken = null;
  generation += 1;
  rememberTraceId(null);
  lostListeners.forEach((listener) => listener(reason));
};

/** JWT 의 sub(사용자 id). JWT 모양이 아니면 null 이다 */
const subjectOf = (token: string): string | null => {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { sub } = JSON.parse(atob(payload)) as { sub?: unknown };
    return typeof sub === 'string' ? sub : null;
  } catch {
    return null;
  }
};
/** 둘 다 읽혔고 서로 다를 때만 다른 계정으로 본다. 못 읽으면 비교하지 않는다 */
const otherAccount = (a: string | null, b: string | null) => a !== null && b !== null && a !== b;

type AuthMessage = {type: 'login';subject: string | null;} | {type: 'logout';};

/**
 * 다른 탭에 로그인·로그아웃을 알린다 (C44·C45). 리프레시 쿠키는 호스트마다 하나라, 다른 탭이 다른 계정으로
 * 로그인하면 이 탭도 다음 재발급부터 그 계정이 된다. 알림을 받은 탭은 서버에 묻지 않고 자기 토큰만 버린다.
 * 모듈을 읽을 때 열면 빌드 때 프리렌더(Node)가 이 모듈을 읽기만 해도 채널이 남아 프로세스가 끝나지 않는다.
 * 그래서 토큰을 처음 쥘 때 연다. BroadcastChannel 이 없는 브라우저는 재발급 때 계정을 맞춰 보는 것(refresh)으로 막는다
 */
let channel: BroadcastChannel | null | undefined;
const authChannel = () => {
  if (channel === undefined) {
    channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('preet-auth');
    channel?.addEventListener('message', ({ data }: MessageEvent<AuthMessage>) => {
      if (accessToken === null) return;
      if (data.type === 'logout') {
        lose('signed-out');
      } else if (otherAccount(data.subject, subjectOf(accessToken))) {
        lose('account-changed');
      }
    });
  }
  return channel;
};
const announce = (message: AuthMessage) => authChannel()?.postMessage(message);

const adopt = (token: string) => {
  accessToken = token;
  authChannel();
};

/**
 * 다른 탭과도 재발급 줄을 세운다 (#195). 탭마다 같은 쿠키로 동시에 보내면 서버가 이미 쓴 리프레시 토큰으로 보고
 * 로그인을 끊는다. 앞 탭의 응답이 쿠키를 바꾼 뒤에 다음 탭이 새 쿠키로 보낸다.
 * Web Locks 가 없는 브라우저는 탭 안에서만 묶는다
 */
const refreshRequest = () => request<{ accessToken: string }>('POST', '/auth/refresh');
const serializedRefresh = async (): Promise<{ accessToken: string }> =>
typeof navigator !== 'undefined' && navigator.locks ?
await navigator.locks.request('auth-refresh', refreshRequest) :
refreshRequest();

let refreshing: Promise<void> | null = null;
/**
 * 동시에 401 을 받은 요청들이 재발급을 한 번만 하도록 진행 중인 재발급을 나눠 쓴다.
 * 실패하면 그 오류로 거절한다. 401 이 아닌 실패(5xx·연결 끊김)는 리프레시 쿠키가 멀쩡할 수 있다
 */
const refresh = () => {
  if (!refreshing) {
    const startedAt = generation;
    refreshing = serializedRefresh().
    then((result) => {
      if (generation !== startedAt) return;
      // 그사이 다른 탭이 다른 계정으로 로그인해 쿠키가 그 계정 것이 됐다. 받으면 이 화면이 남의 데이터를 읽는다 (C44)
      if (accessToken !== null && otherAccount(subjectOf(accessToken), subjectOf(result.accessToken))) {
        lose('account-changed');
        return;
      }
      adopt(result.accessToken);
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
    throw new ApiRequestError(0, 'NETWORK_ERROR', '서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.');
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
      lose('expired');
    }
  }

  if (!response.ok) {
    const error = (data ?? {}) as {
      code?: string;
      message?: string;
      traceId?: string;
      runId?: string;
    };
    // 초 단위만 읽는다. 날짜 형식이면 버린다
    const retryAfter = Number(response.headers.get('Retry-After'));
    // 본문이 없는 오류(프록시의 502)도 서버를 거쳤으면 헤더에 남는다 (#225)
    const traceId = error.traceId ?? response.headers.get('X-Trace-Id') ?? '';
    // 버그 신고에 실을 traceId. 비밀번호를 틀렸거나 쿠키 없이 재발급한 401, 신고 자체의 실패는 신고할 오류가 아니다
    // 그사이 로그인, 로그아웃했거나 로그인이 풀렸으면(lose) 지난 세션의 오류라 적지 않는다
    if (traceId && !isAuthPath(path) && path !== '/bug-reports' && generation === sentAt) rememberTraceId(traceId);
    throw new ApiRequestError(
      response.status,
      error.code ?? 'UNKNOWN',
      // 본문이 없거나(프록시의 502·504) 한글이 없는 서버 기본 문구(Spring 의 영어)면 화면에 올리지 않는다 (C65)
      error.message && /[가-힣]/.test(error.message) ? error.message : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      traceId,
      response.headers.has('Retry-After') && Number.isFinite(retryAfter) ? retryAfter : undefined,
      // 409 RUN_ALREADY_ACTIVE 에만 붙는다 (#228). 문자열이 아니면 없는 것으로 둔다
      typeof error.runId === 'string' ? error.runId : undefined
    );
  }
  return data as T;
}

const get = <T,>(path: string, query?: Query) => request<T>('GET', path, { query });
const post = <T,>(path: string, body?: unknown, idempotencyKey?: string) =>
request<T>('POST', path, { body, idempotencyKey });
const put = <T,>(path: string, body?: unknown) => request<T>('PUT', path, { body });
const del = (path: string) => request<void>('DELETE', path);

/** 응답에서 쓰지 않는 쿼리 값을 거르지 않고 그대로 넘긴다. 서버가 계약의 주인이다 */
const page = (query?: { page?: number; size?: number }): Query => ({
  page: query?.page,
  size: query?.size
});

/** 로그인·가입·카카오 로그인. 응답은 모두 `{accessToken}` + 리프레시 쿠키다 (api.md 1.1) */
const enter = async (path: string, body: unknown) => {
  // 다른 계정으로 로그인하다 실패해도 앞 사람의 토큰이 남지 않게 먼저 버린다. 앞 사람의 오류도 신고에 싣지 않는다
  accessToken = null;
  generation += 1;
  rememberTraceId(null);
  await settled();
  const startedAt = generation;
  const result = await post<{ accessToken: string }>(path, body);
  // 그사이 로그아웃했거나 다시 로그인했으면 이 토큰은 쓰지 않는다
  if (generation !== startedAt) return;
  adopt(result.accessToken);
  announce({ type: 'login', subject: subjectOf(result.accessToken) });
};

export const httpApi: Api = {
  auth: {
    login: (body) => enter('/auth/login', body),
    requestEmailVerification: (body) => post<void>('/auth/email-verification', body),
    confirmEmailVerification: (body) => post('/auth/email-verification/confirm', body),
    signup: (body) => enter('/auth/signup', body),
    requestPasswordReset: (body) => post<void>('/auth/password-reset', body),
    confirmPasswordReset: (body) => post('/auth/password-reset/confirm', body),
    completePasswordReset: (body) => post<void>('/auth/password-reset/complete', body),
    kakao: (body) => enter('/auth/kakao', body),
    // 아직 로그인 전이라 잃을 것이 없다. 어떤 이유로든 못 이어 가면 로그인 화면이다
    restore: () => {
      const startedAt = generation;
      return refresh().then(() => generation === startedAt, () => false);
    },
    logout: async () => {
      generation += 1;
      rememberTraceId(null);
      announce({ type: 'logout' });
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
    remove: () => del('/users/me'),
    changePassword: (body) => put<void>('/users/me/password', body)
  },

  bugReports: {
    create: (body) => post<void>('/bug-reports', body)
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
    export: (scope) => get('/judgments/export', { batchId: scope.batchId, year: scope.year }),
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

  // 경로는 api.md 와 같다
  assistant: {
    chat: (body) => post('/assistant/chat', body)
  },

  progress: {
    get: (batchId) => get('/progress', { batchId })
  },

  handoffNotes: {
    // #214 전 서버에는 저장 API 가 없었다(404). 그때는 저장한 질문이 없는 것과 같다. 다른 실패는 요약이 「빠진 항목」으로 알린다
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
