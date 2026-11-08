import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState } from
'react';
import type {
  BusinessContext,
  BusinessContextRef,
  SignupRequest,
  StoredBusinessContext,
  User } from
'../types/domain';
import { api, seedSession } from '../api';
import { chooseBatch, saveBatchId, savedBatchId } from '../auth/session';
import type { SessionEndReason } from '../auth/session';
import { setSignedInHint } from './signedInHint';

/** restoring: 새로고침 뒤 리프레시 쿠키로 로그인을 이어 가는 중. 이때는 로그인 화면으로 보내지 않는다 */
export type AuthStatus = 'restoring' | 'anonymous' | 'signedIn';

/**
 * 로그인 뒤 볼 업로드를 고르는 중인지 (C56). loading 이면 아직 모른다 — 「올린 카드내역이 없습니다」를 그리지 않는다.
 * ready 인데 batchId 가 null 이면 정말 올린 것이 없다. error 면 목록을 못 읽었다 — reloadBatch 로 다시 고른다.
 * 로그인 전에는 loading 이다
 */
export type BatchStatus = 'loading' | 'error' | 'ready';

/**
 * 저장된 문진을 읽었는지 (C57). none 은 정말 문진 전이고, error 는 조회가 실패한 것이다 — 문진 전으로 다루지 않고
 * reloadContext 로 다시 읽는다. 로그인 전에는 loading 이다
 */
export type ContextStatus = 'loading' | 'error' | 'none' | 'ready';

/** 가입은 됐지만 그 뒤 내 정보를 읽지 못해 로그인하지 못했다. reason 은 실제 실패다 */
export class SignedUpError extends Error {
  constructor(readonly reason: unknown) {
    super('가입은 마쳤지만 로그인하지 못했습니다.');
  }
}

/**
 * 클라이언트 세션. 로그인 상태와 "지금 어느 배치·문진을 보고 있는지"만 든다. 판정 실행은 주소에 싣는다(`/run/:runId`).
 * 판정·질문 같은 서버 상태는 여기 두지 않고 api.* 로 읽는다. 토큰은 api 층 안에만 있다.
 */
interface SessionValue {
  status: AuthStatus;
  isAuthenticated: boolean;
  /** 로그인한 사용자 id. 계정이 바뀌면 바뀐다 */
  userId: string | null;
  /** 카카오 계정이면 로그인해도 null 이다 */
  email: string | null;
  /** users/me 의 role 이 ADMIN 인가 (api.md 3.15) */
  isAdmin: boolean;
  /** 로그인하고 내 정보를 읽는다. 실패하면 ApiRequestError 를 던진다 */
  signIn: (email: string, password: string) => Promise<void>;
  /** 가입하고 바로 로그인한다. 가입이 실패하면 ApiRequestError, 가입은 됐는데 로그인을 못 하면 SignedUpError 를 던진다 */
  signUp: (body: SignupRequest) => Promise<void>;
  /** 카카오 인가 코드로 로그인한다. 실패하면 ApiRequestError 를 던진다 */
  signInWithKakao: (code: string) => Promise<void>;
  /** 이 브라우저의 로그인을 바로 지우고, 서버 로그아웃은 기다리지 않는다 */
  signOut: () => void;
  /** 로그인이 사용자 손을 거치지 않고 끝났으면 그 이유. 직접 로그아웃했거나 다시 로그인하면 null 이다 */
  endReason: SessionEndReason | null;
  /** 서버에 저장된 배치 id */
  batchId: string | null;
  /** 고른 배치를 계정마다 기억한다. 새로고침이나 다시 로그인해도 이 배치로 돌아온다. null 이면 기억을 지운다 */
  setBatchId: (id: string | null) => void;
  batchStatus: BatchStatus;
  /**
   * 서버 목록에서 배치를 다시 고른다. 기억해 둔 배치가 아직 있으면 그것, 없으면 거래가 든 가장 최근 것, 그것도 없으면
   * 가장 최근 것이다. batchStatus 가 error 일 때의 「다시 시도」, 보던 배치를 지운 뒤(setBatchId(null) 다음)에 쓴다
   */
  reloadBatch: () => void;
  /** 문진 입력값과 서버 참조. 서버에서 읽은 것이면 자택 비율이 null(미입력)일 수 있다 */
  context: BusinessContext | StoredBusinessContext | null;
  setContext: (context: BusinessContext | StoredBusinessContext) => void;
  contextRef: BusinessContextRef | null;
  /** 문진을 저장했으면 ref 를 넘긴다. contextStatus 가 ready 가 된다 */
  setContextRef: (ref: BusinessContextRef | null) => void;
  contextStatus: ContextStatus;
  /** 저장된 문진을 다시 읽는다. contextStatus 가 error 일 때의 「다시 시도」 */
  reloadContext: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: {children: React.ReactNode;}) {
  const [status, setStatus] = useState<AuthStatus>('restoring');

  // 로그인 여부가 정해지면 표시를 맞춘다. 이어 가는 중(restoring)에는 건드리지 않는다
  useEffect(() => {
    if (status !== 'restoring') setSignedInHint(status === 'signedIn');
  }, [status]);
  const [user, setUser] = useState<User | null>(null);
  const userId = user?.id ?? null;
  const email = user?.email ?? null;
  const [endReason, setEndReason] = useState<SessionEndReason | null>(null);
  const [batchId, setBatchIdState] = useState<string | null>(seedSession?.batchId ?? null);
  // 목업은 시드 배치로 시작해 고를 것이 없다
  const [batchStatus, setBatchStatus] = useState<BatchStatus>(seedSession ? 'ready' : 'loading');
  const [context, setContext] = useState<BusinessContext | StoredBusinessContext | null>(null);
  const [contextRef, setContextRefState] = useState<BusinessContextRef | null>(seedSession?.contextRef ?? null);
  const [contextStatus, setContextStatus] = useState<ContextStatus>('loading');
  /** 올리면 문진을 다시 읽는다 */
  const [contextAttempt, setContextAttempt] = useState(0);

  /**
   * 로그인·로그아웃·풀림마다 올린다. 그 전에 시작한 이어 가기·내 정보·최근 업로드 응답이 늦게 와도
   * 지금 세션을 바꾸지 않는다 — 늦은 이어 가기가 방금 한 로그인을 「로그인 전」으로 덮거나,
   * 앞 사람의 최근 업로드가 새 세션의 배치로 들어가지 않게 한다
   */
  const epoch = useRef(0);
  /** 배치를 고르거나 지울 때마다 올린다. 늦게 온 목록이 그사이 사용자가 고른 배치를 덮지 않게 한다 */
  const batchPick = useRef(0);
  /** 문진을 저장할 때마다 올린다. 저장 전에 보낸 조회가 늦게 와서 방금 저장한 문진을 덮지 않게 한다 */
  const contextPick = useRef(0);
  /** 배치를 기억할 계정. 콜백이 렌더마다 바뀌지 않게 상태와 따로 둔다 */
  const userIdRef = useRef<string | null>(null);

  const clear = useCallback((reason?: SessionEndReason) => {
    epoch.current += 1;
    batchPick.current += 1;
    contextPick.current += 1;
    userIdRef.current = null;
    setUser(null);
    setStatus('anonymous');
    setEndReason(reason ?? null);
    setBatchIdState(seedSession?.batchId ?? null);
    setBatchStatus(seedSession ? 'ready' : 'loading');
    setContext(null);
    setContextRefState(seedSession?.contextRef ?? null);
    setContextStatus('loading');
  }, []);

  /** 3.3 목록(createdAt DESC)에서 고른다. 기억해 둔 배치가 첫 100개 밖에 있으면 따로 읽어 넣는다 */
  const pickBatch = useCallback((forUser: string) => {
    const picking = ++batchPick.current;
    setBatchStatus('loading');
    void api.uploads.
    list({ size: 100 }).
    then(async (page) => {
      // 목업은 기억해 두지 않는다(setBatchId). 거래가 든 가장 최근 것을 고른다
      const saved = seedSession ? null : savedBatchId(forUser);
      const older =
      saved && page.page.hasNext && !page.items.some((item) => item.id === saved) ?
      await api.uploads.get(saved).catch(() => null) :
      null;
      if (batchPick.current !== picking) return;
      setBatchIdState(chooseBatch(older ? [...page.items, older] : page.items, saved));
      setBatchStatus('ready');
    }).
    catch(() => {
      if (batchPick.current === picking) setBatchStatus('error');
    });
  }, []);

  const setBatchId = useCallback((id: string | null) => {
    batchPick.current += 1;
    setBatchIdState(id);
    setBatchStatus('ready');
    // 목업은 새로고침하면 데이터가 사라져 기억해 둘 것이 없다
    if (userIdRef.current && !seedSession) saveBatchId(userIdRef.current, id);
  }, []);

  const reloadBatch = useCallback(() => {
    if (userIdRef.current) pickBatch(userIdRef.current);
  }, [pickBatch]);

  /** 로그인했다. 실서버는 보던 배치를 계정마다 기억해 둔 것으로 시작한다. 목업은 시드 배치로 시작한다 */
  const start = useCallback((me: User) => {
    userIdRef.current = me.id;
    setUser(me);
    setStatus('signedIn');
    setEndReason(null);
    if (!seedSession) pickBatch(me.id);
  }, [pickBatch]);

  // 새로고침 뒤 리프레시 쿠키로 로그인을 이어 간다 (#139)
  useEffect(() => {
    let cancelled = false;
    const startedAt = epoch.current;
    const stale = () => cancelled || epoch.current !== startedAt;
    void api.auth.
    restore().
    then((restored) => restored ? api.users.me() : null).
    then((me) => {
      if (stale()) return;
      if (me) start(me);
      else setStatus('anonymous');
    }).
    catch(() => {
      if (!stale()) setStatus('anonymous');
    });
    return () => {
      cancelled = true;
    };
  }, [start]);

  /**
   * 재발급까지 실패했거나 다른 탭에서 로그인·로그아웃했다. 이유는 로그인 화면이 알린다.
   * 서버 로그아웃은 부르지 않는다 — 이미 풀린 세션이고, 다른 계정으로 바뀐 경우에는 그 계정의 로그인을 끊는다
   */
  useEffect(() => api.auth.onLost(clear), [clear]);

  /** 로그인·가입·카카오 로그인이 같이 쓴다. 토큰을 받고 나서 내 정보를 읽어야 로그인한 것이다 */
  const enter = useCallback(async (authenticate: () => Promise<void>) => {
    // 앞 사람의 배치·문진이 남지 않게 먼저 비운다 (#142 리뷰). 배치와 문진은 start 뒤에 새 계정 것으로 다시 읽는다
    clear();
    const startedAt = epoch.current;
    await authenticate();
    try {
      const me = await api.users.me();
      // 그사이 로그아웃했거나 다시 로그인했다
      if (epoch.current === startedAt) start(me);
    } catch (caught) {
      // 토큰만 받고 내 정보를 못 읽었으면 로그인하지 않은 것으로 되돌린다. 그사이 바뀐 세션은 건드리지 않는다
      if (epoch.current === startedAt) void api.auth.logout().catch(() => undefined);
      throw caught;
    }
  }, [clear, start]);

  const signIn = useCallback(
    (nextEmail: string, password: string) => enter(() => api.auth.login({ email: nextEmail, password })),
    [enter]
  );
  const signUp = useCallback(async (body: SignupRequest) => {
    let created = false;
    try {
      await enter(async () => {
        await api.auth.signup(body);
        created = true;
      });
    } catch (caught) {
      // 계정은 만들어졌고 인증 토큰도 썼다. 같은 가입을 다시 보내면 실패하니 로그인으로 보내야 한다
      throw created ? new SignedUpError(caught) : caught;
    }
  }, [enter]);
  const signInWithKakao = useCallback((code: string) => enter(() => api.auth.kakao({ code })), [enter]);

  /**
   * 3.2 — 서버에 이미 문진이 있으면 그것을 쓴다. 저장만 하고 다시 읽지 않으면
   * 새로고침할 때마다 「사업자 문진을 먼저 마쳐 주세요」로 돌아간다.
   * 문진 전이면 404 이고 http 구현이 null 로 바꿔 준다. 조회 실패는 문진 전과 가른다 (C57)
   */
  useEffect(() => {
    // 카카오 계정은 email 이 null 이라 사용자 id 로 본다
    if (userId === null) return;
    let cancelled = false;
    const picking = contextPick.current;
    const stale = () => cancelled || contextPick.current !== picking;
    setContextStatus('loading');
    void api.contexts.
    current().
    then((current) => {
      if (stale()) return;
      if (!current) {
        setContextStatus('none');
        return;
      }
      setContext(current);
      setContextRefState({ id: current.id, version: current.version });
      setContextStatus('ready');
    }).
    catch(() => {
      if (!stale()) setContextStatus('error');
    });
    return () => {
      cancelled = true;
    };
  }, [userId, contextAttempt]);

  const setContextRef = useCallback((ref: BusinessContextRef | null) => {
    contextPick.current += 1;
    setContextRefState(ref);
    setContextStatus(ref ? 'ready' : 'none');
  }, []);

  const reloadContext = useCallback(() => setContextAttempt((attempt) => attempt + 1), []);

  const signOut = useCallback(() => {
    void api.auth.logout().catch(() => undefined);
    clear();
  }, [clear]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      isAuthenticated: status === 'signedIn',
      userId,
      email,
      isAdmin: user?.role === 'ADMIN',
      signIn,
      signUp,
      signInWithKakao,
      signOut,
      endReason,
      batchId,
      setBatchId,
      batchStatus,
      reloadBatch,
      context,
      setContext,
      contextRef,
      setContextRef,
      contextStatus,
      reloadContext
    }),
    [
    status,
    userId,
    email,
    user,
    signIn,
    signUp,
    signInWithKakao,
    signOut,
    endReason,
    batchId,
    setBatchId,
    batchStatus,
    reloadBatch,
    context,
    contextRef,
    setContextRef,
    contextStatus,
    reloadContext]

  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>);

}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return value;
}
