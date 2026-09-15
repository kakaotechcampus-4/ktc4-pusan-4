import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState } from
'react';
import type { BusinessContext, Judgment, Transaction, Verdict } from '../types/domain';
import {
  JUDGMENTS,
  JUDGMENT_SUMMARY,
  QUESTION_ANSWER_VERDICT,
  QUESTION_GROUPS,
  QUESTION_TRANSACTIONS,
  TRANSACTIONS } from
'../mock/judgments';
import type { ParsedBatch } from '../mock/sampleFiles';
import { VERDICT_LABEL } from '../utils/verdict';

/** 업종은 IT(62010) 고정 */
export const DEFAULT_CONTEXT: BusinessContext = {
  industryCode: '62010',
  prevYearRevenue: 83_000_000,
  businessOpenDate: '2024-03-01',
  bookkeepingDuty: '복식부기',
  hasEmployee: false,
  homeOfficeRatio: 20
};

/** 목업 화면의 진행 단계. API의 RunStatus와 다르다. */
export type DemoRunStatus = 'IDLE' | 'RUNNING' | 'DONE';

interface VerdictCounts {
  available: number;
  needsReview: number;
  unavailable: number;
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
  runStatus: DemoRunStatus;
  setRunStatus: (status: DemoRunStatus) => void;
  /** 그룹 키 → 선택한 답변 라벨 */
  answers: Record<string, string>;
  answerGroup: (groupKey: string, value: string) => void;
  overrides: Record<string, Verdict>;
  overrideJudgment: (judgmentId: string, verdict: Verdict) => void;
  judgments: Judgment[];
  transactionOf: (transactionId: string) => Transaction | undefined;
  counts: VerdictCounts;
  pendingQuestionCount: number;
  recognizedAmount: number;
}

const SessionContext = createContext<SessionValue | null>(null);

const ratioOf = (answer: string): number | null =>
/^\d+%$/.test(answer) ? Number(answer.replace('%', '')) : null;

const coded = (code: Verdict) => ({ code, label: VERDICT_LABEL[code] });

/** 거래 → 소속 질문 그룹. 목업 전용 역매핑 */
const GROUP_OF_TRANSACTION: Record<string, string> = Object.fromEntries(
  Object.entries(QUESTION_TRANSACTIONS).flatMap(([groupKey, ids]) =>
  ids.map((id) => [id, groupKey])
  )
);

export function SessionProvider({ children }: {children: React.ReactNode;}) {
  const [email, setEmail] = useState<string | null>(null);
  const [batch, setBatch] = useState<ParsedBatch | null>(null);
  const [context, setContext] = useState<BusinessContext | null>(null);
  const [runStatus, setRunStatus] = useState<DemoRunStatus>('IDLE');
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

  const transactionOf = useCallback(
    (transactionId: string) =>
    TRANSACTIONS.find((transaction) => transaction.id === transactionId),
    []
  );

  /** 응답 → 재판정 → 새 Revision 을 클라이언트에서 흉내 낸다. 서버에서는 룰엔진이 한다. */
  const judgments = useMemo<Judgment[]>(
    () =>
    JUDGMENTS.map((judgment) => {
      const groupKey = GROUP_OF_TRANSACTION[judgment.transactionId];
      const answer = groupKey ? answers[groupKey] : undefined;
      let next = judgment;

      if (groupKey && answer) {
        const verdict = QUESTION_ANSWER_VERDICT[groupKey]?.[answer] ?? 'NEEDS_REVIEW';
        const ratio = ratioOf(answer);
        const amount = transactionOf(judgment.transactionId)?.amount ?? 0;
        next = {
          ...judgment,
          revision: judgment.revision + 1,
          verdict: coded(verdict),
          blockedAtGate: verdict === 'NEEDS_REVIEW' ? judgment.blockedAtGate : null,
          isInference: false,
          unmatchedReason: null,
          attributes: ratio !== null ? { 안분율: ratio } : judgment.attributes,
          finalAmount:
          verdict !== 'AVAILABLE' ?
          null :
          ratio !== null ?
          Math.floor(amount * ratio / 100) :
          amount,
          explanation:
          verdict === 'AVAILABLE' ?
          ratio !== null ?
          `사용자 응답으로 업무 사용 비율 ${ratio}%를 적용해 구분되는 금액만 산입합니다.` :
          '사용자 응답으로 용도가 업무로 확인되어 통상성 게이트를 통과했습니다.' :
          verdict === 'UNAVAILABLE' ?
          '사용자 응답에 따라 개인 목적 지출로 확정되어 필요경비에 산입하지 않습니다.' :
          judgment.explanation,
          computedAt: new Date().toISOString()
        };
      }

      const override = overrides[judgment.id];
      if (override) {
        next = {
          ...next,
          revision: next.revision + 1,
          verdict: coded(override),
          finalAmount:
          override === 'AVAILABLE' ?
          next.finalAmount ?? transactionOf(judgment.transactionId)?.amount ?? null :
          null
        };
      }

      return next;
    }),
    [answers, overrides, transactionOf]
  );

  const counts = useMemo<VerdictCounts>(() => {
    let { available, needsReview, unavailable } = {
      available: JUDGMENT_SUMMARY.byVerdict.AVAILABLE.count,
      needsReview: JUDGMENT_SUMMARY.byVerdict.NEEDS_REVIEW.count,
      unavailable: JUDGMENT_SUMMARY.byVerdict.UNAVAILABLE.count
    };
    QUESTION_GROUPS.forEach((group) => {
      const answer = answers[group.groupKey];
      if (!answer) return;
      const verdict = QUESTION_ANSWER_VERDICT[group.groupKey]?.[answer];
      if (!verdict || verdict === 'NEEDS_REVIEW') return;
      needsReview -= group.count;
      if (verdict === 'AVAILABLE') available += group.count;else
      unavailable += group.count;
    });
    return { available, needsReview, unavailable };
  }, [answers]);

  const pendingQuestionCount = useMemo(
    () =>
    QUESTION_GROUPS.filter((group) => {
      const answer = answers[group.groupKey];
      if (!answer) return true;
      return QUESTION_ANSWER_VERDICT[group.groupKey]?.[answer] === 'NEEDS_REVIEW';
    }).length,
    [answers]
  );

  const recognizedAmount = useMemo(() => {
    const extra = QUESTION_GROUPS.reduce((sum, group) => {
      const answer = answers[group.groupKey];
      if (!answer) return sum;
      const ratio = ratioOf(answer);
      if (ratio !== null) {
        return sum + Math.floor(group.totalAmount * ratio / 100);
      }
      return QUESTION_ANSWER_VERDICT[group.groupKey]?.[answer] === 'AVAILABLE' ?
      sum + group.totalAmount :
      sum;
    }, 0);
    return JUDGMENT_SUMMARY.byVerdict.AVAILABLE.finalAmount + extra;
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
      transactionOf,
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
    transactionOf,
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
