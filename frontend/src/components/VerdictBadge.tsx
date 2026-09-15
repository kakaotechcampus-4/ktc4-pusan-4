import type { Coded, Verdict } from '../types/domain';
import { VERDICT_META } from '../utils/verdict';
import { Badge } from './ui/Badge';

interface VerdictBadgeProps {
  verdict: Coded<Verdict>;
  size?: 'sm' | 'md';
}

/** 판정 3분류 배지. 라벨은 API 값, 기호·색은 VERDICT_META. */
export function VerdictBadge({ verdict, size = 'sm' }: VerdictBadgeProps) {
  const meta = VERDICT_META[verdict.code];
  return (
    <Badge tone={meta.tone} size={size} symbol={meta.symbol}>
      {verdict.label}
    </Badge>);

}
