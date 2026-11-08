import type { Judgment, Verdict } from '../types/domain';

export type ShareKey = Verdict | 'AWAITING';

/** 판정별 몫 한 줄. amount 는 그 판정이 난 거래의 결제 금액 합이고, 못 읽었으면 null */
export interface Share {
  key: ShareKey;
  count: number;
  amount: number | null;
}

/** 판정색 채움. 답변 대기는 판정이 아니라 불가에 붙는 표지라 판정 색을 쓰지 않는다 */
export const SHARE_BAR: Record<ShareKey, string> = {
  AVAILABLE: 'bg-ok-bar',
  NEEDS_REVIEW: 'bg-warn-bar',
  UNAVAILABLE: 'bg-deny-bar',
  AWAITING: 'bg-edge'
};

const spendOf = (judgments: Judgment[]) => judgments.reduce((sum, judgment) => sum + judgment.transaction.amount, 0);

/**
 * 현재 판정 전부에서 판정별 건수와 결제 금액을 센다. 답을 기다리는 불가는 불가에서 빼서 따로 센다 (C12).
 * awaiting 을 못 읽었으면(null) 답변 대기를 따로 두지 않는다
 */
export const sharesOf = (judgments: Judgment[], awaiting: Judgment[] | null): Share[] => {
  const waiting = new Set(awaiting ?? []);
  const of = (key: Verdict) =>
  judgments.filter((judgment) => judgment.verdict.code === key && !waiting.has(judgment));
  return [
  ...(['AVAILABLE', 'NEEDS_REVIEW', 'UNAVAILABLE'] as const).map((key) => {
    const rows = of(key);
    return { key, count: rows.length, amount: spendOf(rows) };
  }),
  ...(waiting.size > 0 ? [{ key: 'AWAITING' as const, count: waiting.size, amount: spendOf([...waiting]) }] : [])];

};
