import React from 'react';
import type { Verdict } from '../types/domain';
import { VERDICT_META } from '../utils/verdict';
import { Badge, type BadgeTone } from './ui/Badge';

const TONE: Record<Verdict, BadgeTone> = {
  POSSIBLE: 'ok',
  NEEDS_REVIEW: 'warn',
  IMPOSSIBLE: 'deny'
};

interface VerdictBadgeProps {
  verdict: Verdict;
  size?: 'sm' | 'md';
}

/** 판정 3분류 배지. 색·기호·라벨은 VERDICT_META 한 곳에서 온다. */
export function VerdictBadge({ verdict, size = 'sm' }: VerdictBadgeProps) {
  const meta = VERDICT_META[verdict];
  return (
    <Badge tone={TONE[verdict]} size={size} symbol={meta.symbol}>
      {meta.label}
    </Badge>);

}
