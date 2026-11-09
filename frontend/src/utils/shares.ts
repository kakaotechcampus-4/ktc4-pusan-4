import type { JudgmentSummary, Verdict } from '../types/domain';

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

/** 범위의 결제 금액 합. 경비 가능 금액의 바탕이다 */
export const spendOf = ({ byVerdict }: JudgmentSummary) =>
byVerdict.AVAILABLE.spendAmount + byVerdict.NEEDS_REVIEW.spendAmount + byVerdict.UNAVAILABLE.spendAmount;

/**
 * 요약에서 판정별 건수와 결제 금액을 꺼낸다. 답을 기다리는 불가는 불가에서 빼서 따로 센다 (C12).
 * 서버 요약의 불가에는 답변 대기가 들어 있다(api.md 3.7 summary 의 awaiting)
 */
export const sharesOf = ({ byVerdict, awaiting }: JudgmentSummary): Share[] => [
{ key: 'AVAILABLE', count: byVerdict.AVAILABLE.count, amount: byVerdict.AVAILABLE.spendAmount },
{ key: 'NEEDS_REVIEW', count: byVerdict.NEEDS_REVIEW.count, amount: byVerdict.NEEDS_REVIEW.spendAmount },
{
  key: 'UNAVAILABLE',
  count: byVerdict.UNAVAILABLE.count - awaiting.count,
  amount: byVerdict.UNAVAILABLE.spendAmount - awaiting.spendAmount
},
...(awaiting.count > 0 ? [{ key: 'AWAITING' as const, count: awaiting.count, amount: awaiting.spendAmount }] : [])];
