import React from 'react';
import { cn } from './cn';

export type BadgeTone = 'ok' | 'warn' | 'deny' | 'neutral' | 'ink' | 'inverse';
export type BadgeSize = 'sm' | 'md';

/**
 * ok·warn·deny 는 판정(가능·확인 필요·불가)에만 쓴다. 판정 배지는 VerdictBadge 가 고른다.
 * 업로드 상태, 처리 상태, 「보는 중」처럼 판정이 아닌 것은 neutral 이다 (DESIGN.md 판정색 규칙)
 */
const TONE: Record<BadgeTone, string> = {
  ok: 'border-ok-line bg-ok-bg text-ok',
  warn: 'border-warn-line bg-warn-bg text-warn',
  deny: 'border-deny-line bg-deny-bg text-deny',
  neutral: 'border-accent-line bg-sheet text-ink2',
  ink: 'border-ink bg-ink text-white',
  inverse: 'border-white/25 bg-transparent text-white'
};

const SIZE: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm'
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
  /** 색각이상 대응: 색만으로 구분하지 않도록 기호를 같이 넣는다 */
  symbol?: string;
}

export function Badge({
  tone = 'neutral',
  size = 'sm',
  symbol,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-bold',
        TONE[tone],
        SIZE[size],
        className
      )}
      {...rest}>
      
      {symbol &&
      <span aria-hidden="true" className="font-bold leading-none">
          {symbol}
        </span>
      }
      {children}
    </span>);

}
