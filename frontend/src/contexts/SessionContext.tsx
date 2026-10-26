import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState } from
'react';
import type { BusinessContext, BusinessContextRef, StoredBusinessContext, User } from '../types/domain';
import { api, seedSession } from '../api';

/** 업종은 IT(62010) 고정 */
export const DEFAULT_CONTEXT: BusinessContext = {
  industryCode: '62010',
  prevYearRevenue: 83_000_000,
  businessOpenDate: '2024-03-01',
  bookkeepingDuty: '복식부기',
  hasEmployee: false,
  homeOfficeRatio: 20
};

/** restoring: 새로고침 뒤 리프레시 쿠키로 로그인을 이어 가는 중. 이때는 로그인 화면으로 보내지 않는다 */
export type AuthStatus = 'restoring' | 'anonymous' | 'signedIn';

/**
 * 클라이언트 세션. 로그인 상태와 "지금 어느 배치·문진·실행을 보고 있는지"만 든다.
 * 판정·질문 같은 서버 상태는 여기 두지 않고 api.* 로 읽는다. 토큰은 api 층 안에만 있다.
 */
interface SessionValue {
  status: AuthStatus;
  isAuthenticated: boolean;
  email: string | null;
  /** users/me 의 역할 (가정. backend_api_plan.md 관리자 판별은 10/26 결정) */
  isAdmin: boolean;
  /** 로그인하고 내 정보를 읽는다. 실패하면 ApiRequestError 를 던진다 */
  signIn: (email: string, password: string) => Promise<void>;
  /** 이 브라우저의 로그인을 바로 지우고, 서버 로그아웃은 기다리지 않는다 */
  signOut: () => void;
  /** 서버에 저장된 배치 id */
  batchId: string | null;
  setBatchId: (id: string | null) => void;
  /** 문진 입력값과 서버 참조. 서버에서 읽은 것이면 자택 비율이 null(미입력)일 수 있다 */
  context: BusinessContext | StoredBusinessContext | null;
  setContext: (context: BusinessContext | StoredBusinessContext) => void;
  contextRef: BusinessContextRef | null;
  setContextRef: (ref: BusinessContextRef | null) => void;
  /** 현재 판정 실행 */
  runId: string | null;
  setRunId: (id: string | null) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: {children: React.ReactNode;}) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [user, setUser] = useState<User | null>(null);
  const email = user?.email ?? null;
  const [batchId, setBatchId] = useState<string | null>(seedSession?.batchId ?? null);
  const [context, setContext] = useState<BusinessContext | StoredBusinessContext | null>(null);
  const [contextRef, setContextRef] = useState<BusinessContextRef | null>(seedSession?.contextRef ?? null);
  const [runId, setRunId] = useState<string | null>(seedSession?.runId ?? null);

  /**
   * 로그인·로그아웃·풀림마다 올린다. 그 전에 시작한 이어 가기·내 정보·최근 업로드 응답이 늦게 와도
   * 지금 세션을 바꾸지 않는다 — 늦은 이어 가기가 방금 한 로그인을 「로그인 전」으로 덮거나,
   * 앞 사람의 최근 업로드가 새 세션의 배치로 들어가지 않게 한다
   */
  const epoch = useRef(0);

  const clear = useCallback(() => {
    epoch.current += 1;
    setUser(null);
    setStatus('anonymous');
    setBatchId(seedSession?.batchId ?? null);
    setContext(null);
    setContextRef(seedSession?.contextRef ?? null);
    setRunId(seedSession?.runId ?? null);
  }, []);

  /**
   * 로그인했다. 실서버에서는 보던 배치가 메모리에만 있어 새로고침하면 사라지므로, 가장 최근 업로드로 시작한다
   * (3.3 목록은 createdAt DESC). 목업은 시드 배치로 시작한다
   */
  const start = useCallback((me: User) => {
    setUser(me);
    setStatus('signedIn');
    if (seedSession) return;
    const startedAt = epoch.current;
    void api.uploads.
    list({ size: 1 }).
    then((page) => {
      if (epoch.current === startedAt) setBatchId((current) => current ?? page.items[0]?.id ?? null);
    }).
    catch(() => {
      // 못 읽으면 「올린 카드내역이 없습니다」에서 업로드 이력으로 가면 된다
    });
  }, []);

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

  // 재발급까지 실패했다. 서버 로그아웃은 부르지 않는다 — 이미 풀린 세션이고, 부르면 다시 401 이 난다
  useEffect(() => api.auth.onLost(clear), [clear]);

  const signIn = useCallback(async (nextEmail: string, password: string) => {
    // 로그인한 채로 /login 에서 다른 계정으로 들어오면 앞 사람의 배치·문진·실행이 남는다.
    // start 는 이미 있는 배치를 덮지 않고, 문진 효과는 서버에 문진이 없으면 그대로 둔다 (#142 리뷰)
    clear();
    const startedAt = epoch.current;
    await api.auth.login({ email: nextEmail, password });
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

  /**
   * 3.2 — 서버에 이미 문진이 있으면 그것을 쓴다. 저장만 하고 다시 읽지 않으면
   * 새로고침할 때마다 「사업자 문진을 먼저 마쳐 주세요」로 돌아간다.
   * 문진 전이면 404 이고 http 구현이 null 로 바꿔 준다.
   */
  useEffect(() => {
    if (email === null) return;
    let cancelled = false;
    void api.contexts.
    current().
    then((current) => {
      if (cancelled || !current) return;
      setContext(current);
      setContextRef({ id: current.id, version: current.version });
    }).
    catch(() => {
      // 조회 실패는 「문진 전」과 같게 다룬다. 화면이 막아 주고 안내도 거기서 한다
    });
    return () => {
      cancelled = true;
    };
  }, [email]);

  const signOut = useCallback(() => {
    void api.auth.logout().catch(() => undefined);
    clear();
  }, [clear]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      isAuthenticated: status === 'signedIn',
      email,
      isAdmin: user?.role === 'ADMIN',
      signIn,
      signOut,
      batchId,
      setBatchId,
      context,
      setContext,
      contextRef,
      setContextRef,
      runId,
      setRunId
    }),
    [status, email, user, signIn, signOut, batchId, context, contextRef, runId]
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
