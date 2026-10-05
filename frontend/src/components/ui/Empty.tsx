import React from 'react';
import { cn } from './cn';

interface EmptyProps {
  /** 상태를 나타내는 아이콘. 장식이므로 의미는 제목이 진다 */
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** 다음에 할 행동이 있을 때만 */
  action?: React.ReactNode;
  tone?: 'neutral' | 'ok';
  className?: string;
}

/** 목록이 비었을 때. "없음"이 아니라 "왜 없는지"를 말한다. */
export function Empty({
  icon,
  title,
  description,
  action,
  tone = 'neutral',
  className
}: EmptyProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center',
        tone === 'ok' ? 'border-ok-line bg-ok-bg/40' : 'border-line bg-canvas',
        className
      )}>
      
      {icon &&
      <span
        aria-hidden="true"
        className={cn(
          'mb-4 flex h-11 w-11 items-center justify-center rounded-full',
          tone === 'ok' ? 'bg-ok-bg text-ok' : 'bg-line2 text-muted'
        )}>
        
          {icon}
        </span>
      }
      <p className="text-h4 font-bold text-ink">{title}</p>
      {description &&
      <p className="mt-2 max-w-md text-body text-muted">{description}</p>
      }
      {action && <div className="mt-6">{action}</div>}
    </div>);

}
