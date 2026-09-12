import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState } from
'react';
import type {
  BusinessContext,
  Judgment,
  ParsedBatch,
  Verdict } from
'../types/domain';
import { BATCH_SUMMARY, JUDGMENTS, QUESTION_GROUPS } from '../mock/judgments';

export const DEFAULT_CONTEXT: BusinessContext = {
  industryCode: '62010',
  prevYearRevenue: 83_000_000,
  businessOpenDate: '2024-03-01',
  hasEmployees: false,
  workplaceType: 'HOME',
  homeOfficeRatio: 20,
  hasVehicle: false,
  hasPhysicalFacility: false
};

export type RunStatus = 'IDLE' | 'RUNNING' | 'DONE';

interface VerdictCounts {
  possible: number;
  needsReview: number;
  impossible: number;
}

interface SessionValue {
  isAuthenticated: boolean;
  email: string | null;
  signIn: (email: string) => void;
  signOut: () => void;
  batch: ParsedBatch | null;
  setBatch: (batch: ParsedBatch | null) => void;
  context: BusinessContext | null;
  setContext: (context: BusinessContext) => void;
  runStatus: RunStatus;
  setRunStatus: (status: RunStatus) => void;
  answers: Record<string, string>;
  answerGroup: (groupKey: string, value: string) => void;
  overrides: Record<string, Verdict>;
  overrideJudgment: (judgmentId: string, verdict: Verdict) => void;
  judgments: Judgment[];
  counts: VerdictCounts;
  pendingQuestionCount: number;
  recognizedAmount: number;
}

const SessionContext = createContext<SessionValue | null>(null);

const answerToVerdict = (value: string): Verdict => {
  if (value === 'PERSONAL') return 'IMPOSSIBLE';
  if (value === 'MIXED' || value === 'UNKNOWN') return 'NEEDS_REVIEW';
  return 'POSSIBLE';
};

export function SessionProvider({ children }: {children: React.ReactNode;}) {
  const [email, setEmail] = useState<string | null>(null);
  const [batch, setBatch] = useState<ParsedBatch | null>(null);
  const [context, setContext] = useState<BusinessContext | null>(null);
  const [runStatus, setRunStatus] = useState<RunStatus>('IDLE');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, Verdict>>({});

  const signIn = useCallback((nextEmail: string) => {
    setEmail(nextEmail);
  }, []);

  const signOut = useCallback(() => {
    setEmail(null);
    setBatch(null);
    setContext(null);
    setRunStatus('IDLE');
    setAnswers({});
    setOverrides({});
  }, []);

  const answerGroup = useCallback((groupKey: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [groupKey]: value }));
  }, []);

  const overrideJudgment = useCallback(
    (judgmentId: string, verdict: Verdict) => {
      setOverrides((prev) => ({ ...prev, [judgmentId]: verdict }));
    },
    []
  );

  /** 응답 → 사실 저장 → 재판정 → 새 Revision 을 클라이언트에서 재현한다. */
  const judgments = useMemo<Judgment[]>(
    () =>
    JUDGMENTS.map((judgment) => {
      const answer = judgment.groupKey ? answers[judgment.groupKey] : undefined;
      let next = judgment;

      if (answer) {
        const isRatio = /^\d+$/.test(answer);
        const verdict = isRatio ? 'POSSIBLE' : answerToVerdict(answer);
        const ratio = isRatio ? Number(answer) : null;
        const amount = judgment.transaction.amount;
        next = {
          ...judgment,
          verdict,
          ratio,
          blockedAtGate: verdict === 'NEEDS_REVIEW' ? judgment.blockedAtGate : null,
          reasonCode: verdict === 'NEEDS_REVIEW' ? judgment.reasonCode : null,
          finalAmount:
          verdict !== 'POSSIBLE' ?
          0 :
          ratio !== null ?
          Math.floor(amount * ratio / 100) :
          amount,
          reason:
          verdict === 'POSSIBLE' ?
          `사용자 응답이 사실 저장소에 저장되어 재판정했습니다.${
          ratio !== null ?
          ` 업무 사용 비율 ${ratio}%를 적용해 구분되는 금액만 산입합니다.` :
          ' 용도가 업무로 확인되어 통상성 게이트를 통과했습니다.'}` :

          verdict === 'IMPOSSIBLE' ?
          '사용자 응답에 따라 개인 목적 지출로 확정되어 필요경비에 산입하지 않습니다.' :
          judgment.reason,
          gateTrace: [
          ...judgment.gateTrace.slice(0, 2),
          {
            gate: 'G2' as const,
            result: `사실 저장소 적용: ${answer}`
          },
          ...(verdict === 'POSSIBLE' ?
          [
          {
            gate: 'G4' as const,
            result:
            ratio !== null ?
            `안분율 ${ratio}% 적용 후 절사` :
            '전액 산입'
          },
          { gate: 'G6' as const, result: '근거 조문 유지' }] :

          [])]

        };
      }

      const override = overrides[judgment.id];
      if (override) {
        next = {
          ...next,
          verdict: override,
          finalAmount: override === 'POSSIBLE' ? next.finalAmount : 0
        };
      }

      return next;
    }),
    [answers, overrides]
  );

  const counts = useMemo<VerdictCounts>(() => {
    let { possible, needsReview, impossible } = {
      possible: BATCH_SUMMARY.possible,
      needsReview: BATCH_SUMMARY.needsReview,
      impossible: BATCH_SUMMARY.impossible
    };
    QUESTION_GROUPS.forEach((group) => {
      const answer = answers[group.groupKey];
      if (!answer) return;
      const verdict = /^\d+$/.test(answer) ?
      'POSSIBLE' :
      answerToVerdict(answer);
      if (verdict === 'NEEDS_REVIEW') return;
      needsReview -= group.count;
      if (verdict === 'POSSIBLE') possible += group.count;else
      impossible += group.count;
    });
    return { possible, needsReview, impossible };
  }, [answers]);

  const pendingQuestionCount = useMemo(
    () =>
    QUESTION_GROUPS.filter((group) => {
      const answer = answers[group.groupKey];
      return !answer || answer === 'MIXED' || answer === 'UNKNOWN';
    }).length,
    [answers]
  );

  const recognizedAmount = useMemo(() => {
    const extra = QUESTION_GROUPS.reduce((sum, group) => {
      const answer = answers[group.groupKey];
      if (!answer) return sum;
      if (/^\d+$/.test(answer)) {
        return sum + Math.floor(group.amount * Number(answer) / 100);
      }
      return answer === 'BUSINESS' || answer === 'SOFTWARE' || answer === 'WITHIN_YEAR' ?
      sum + group.amount :
      sum;
    }, 0);
    return BATCH_SUMMARY.possibleAmount + extra;
  }, [answers]);

  const value = useMemo<SessionValue>(
    () => ({
      isAuthenticated: email !== null,
      email,
      signIn,
      signOut,
      batch,
      setBatch,
      context,
      setContext,
      runStatus,
      setRunStatus,
      answers,
      answerGroup,
      overrides,
      overrideJudgment,
      judgments,
      counts,
      pendingQuestionCount,
      recognizedAmount
    }),
    [
    email,
    signIn,
    signOut,
    batch,
    context,
    runStatus,
    answers,
    answerGroup,
    overrides,
    overrideJudgment,
    judgments,
    counts,
    pendingQuestionCount,
    recognizedAmount]

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