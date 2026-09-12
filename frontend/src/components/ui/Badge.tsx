import React from 'react';
import { cn } from './cn';

export type BadgeTone = 'ok' | 'warn' | 'deny' | 'neutral' | 'ink' | 'inverse';
export type BadgeSize = 'sm' | 'md';

/** 상태색은 배경·테두리·글자를 항상 세트로 쓴다 (DESIGN.md 상태색 규칙) */
const TONE: Record<BadgeTone, string> = {
  ok: 'border-ok-line bg-ok-bg text-ok',
  warn: 'border-warn-line bg-warn-bg text-warn',
  deny: 'border-deny-line bg-deny-bg text-deny',
  neutral: 'border-line bg-surface text-muted',
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
        'inline-flex items-center gap-1.5 rounded-full border font-semibold',
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
