import React from 'react';
import { cn } from './cn';

/**
 * neutral 은 아직 없음, ok 는 다 처리해서 비었음, error 는 불러오지 못했음.
 * ok 는 판정색(초록)을 쓰지 않는다 — 판정색은 판정에만 쓴다. 다 했다는 것은 accent 아이콘으로만 알린다.
 * error 는 화면 전체가 실패했을 때 쓰는 단 하나의 붉은 상자다. 칸 하나가 실패한 것은 그 옆의 deny 글자로 알린다
 */
type EmptyTone = 'neutral' | 'ok' | 'error';

const ICON: Record<EmptyTone, string> = {
  neutral: 'border border-line text-ink2',
  ok: 'bg-accent-soft text-accent-hover',
  error: 'bg-canvas text-deny'
};

interface EmptyProps {
  /** 상태를 나타내는 아이콘. 장식이므로 의미는 제목이 진다 */
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** 다음에 할 행동이 있을 때만 */
  action?: React.ReactNode;
  tone?: EmptyTone;
  /**
   * 걸러 낸 표가 비었을 때. 상자를 그리지 않고 표 머리의 굵은 괘선 아래를 비운다.
   * 필터 바로 아래에 점선 상자가 붙으면 필터와 한 덩어리로 보인다
   */
  inTable?: boolean;
  className?: string;
}

/** 목록이 비었을 때. "없음"이 아니라 "왜 없는지"를 말한다. */
export function Empty({
  icon,
  title,
  description,
  action,
  tone = 'neutral',
  inTable = false,
  className
}: EmptyProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        inTable && tone !== 'error' ?
        'border-t border-line px-6 py-12' :
        cn('rounded-2xl border px-6 py-14', tone === 'error' ? 'border-deny-line bg-deny-bg' : 'border-dashed border-line bg-canvas'),
        className
      )}>

      {icon &&
      <span
        aria-hidden="true"
        className={cn('mb-4 flex h-11 w-11 items-center justify-center rounded-full', ICON[tone])}>

          {icon}
        </span>
      }
      <p className="text-h4 font-bold text-ink">{title}</p>
      {description &&
      <p className="mt-2 max-w-md text-body text-ink2">{description}</p>
      }
      {action && <div className="mt-6">{action}</div>}
    </div>);

}
