import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState } from
'react';
import type { BusinessContext, BusinessContextRef } from '../types/domain';
import type { ParsedBatch } from '../mock/sampleFiles';
import { seedSession } from '../api';

/** 업종은 IT(62010) 고정 */
export const DEFAULT_CONTEXT: BusinessContext = {
  industryCode: '62010',
  prevYearRevenue: 83_000_000,
  businessOpenDate: '2024-03-01',
  bookkeepingDuty: '복식부기',
  hasEmployee: false,
  homeOfficeRatio: 20
};

/**
 * 클라이언트 세션. 로그인 상태와 "지금 어느 배치·문진·실행을 보고 있는지"만 든다.
 * 판정·질문 같은 서버 상태는 여기 두지 않고 api.* 로 읽는다.
 */
interface SessionValue {
  isAuthenticated: boolean;
  email: string | null;
  signIn: (email: string) => void;
  signOut: () => void;
  /** 브라우저 파싱 결과 (업로드 화면 → 확인 화면) */
  batch: ParsedBatch | null;
  setBatch: (batch: ParsedBatch | null) => void;
  /** 서버에 저장된 배치 id */
  batchId: string | null;
  setBatchId: (id: string | null) => void;
  /** 문진 입력값과 서버 참조 */
  context: BusinessContext | null;
  setContext: (context: BusinessContext) => void;
  contextRef: BusinessContextRef | null;
  setContextRef: (ref: BusinessContextRef | null) => void;
  /** 현재 판정 실행 */
  runId: string | null;
  setRunId: (id: string | null) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: {children: React.ReactNode;}) {
  const [email, setEmail] = useState<string | null>(null);
  const [batch, setBatch] = useState<ParsedBatch | null>(null);
  const [batchId, setBatchId] = useState<string | null>(seedSession?.batchId ?? null);
  const [context, setContext] = useState<BusinessContext | null>(null);
  const [contextRef, setContextRef] = useState<BusinessContextRef | null>(seedSession?.contextRef ?? null);
  const [runId, setRunId] = useState<string | null>(seedSession?.runId ?? null);

  const signIn = useCallback((nextEmail: string) => {
    setEmail(nextEmail);
  }, []);

  const signOut = useCallback(() => {
    setEmail(null);
    setBatch(null);
    setBatchId(seedSession?.batchId ?? null);
    setContext(null);
    setContextRef(seedSession?.contextRef ?? null);
    setRunId(seedSession?.runId ?? null);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      isAuthenticated: email !== null,
      email,
      signIn,
      signOut,
      batch,
      setBatch,
      batchId,
      setBatchId,
      context,
      setContext,
      contextRef,
      setContextRef,
      runId,
      setRunId
    }),
    [email, signIn, signOut, batch, batchId, context, contextRef, runId]
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
