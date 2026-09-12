import type { Verdict } from '../types/domain';

interface VerdictMeta {
  label: string;
  /** 색각이상 대응: 색 + 기호 + 테두리를 함께 쓴다 */
  symbol: string;
  text: string;
  bg: string;
  border: string;
  dot: string;
}

export const VERDICT_META: Record<Verdict, VerdictMeta> = {
  POSSIBLE: {
    label: '가능',
    symbol: '✓',
    text: 'text-ok',
    bg: 'bg-ok-bg',
    border: 'border-ok-line',
    dot: 'bg-ok'
  },
  NEEDS_REVIEW: {
    label: '확인 필요',
    symbol: '?',
    text: 'text-warn',
    bg: 'bg-warn-bg',
    border: 'border-warn-line',
    dot: 'bg-warn'
  },
  IMPOSSIBLE: {
    label: '불가',
    symbol: '✕',
    text: 'text-deny',
    bg: 'bg-deny-bg',
    border: 'border-deny-line',
    dot: 'bg-deny'
  }
};

export const REASON_LABEL: Record<string, string> = {
  PURPOSE_UNKNOWN: '용도 불명',
  RATIO_MISSING: '안분율 없음',
  PERIOD_UNKNOWN: '기간 불명',
  EXCLUSIVE_USE_UNKNOWN: '전용 여부 불명',
  MERCHANT_UNRESOLVED: '가맹점 미해결'
};