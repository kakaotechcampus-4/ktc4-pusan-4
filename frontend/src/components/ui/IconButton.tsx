import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from './cn';

/**
 * 글자 없이 그림만 있는 버튼(지우기, 보기, 고치기, 복사, 내려받기). 하는 일은 aria-label 로 읽어 주고
 * 마우스를 올리면 title 로 보인다. 높이는 Button sm 과 같은 36px 이다
 */
interface IconButtonProps {
  label: string;
  icon: LucideIcon;
  /** secondary 는 테두리가 있고, ghost 는 바탕만 바뀐다 */
  variant?: 'secondary' | 'ghost';
  /** 있으면 라우터 링크다 */
  to?: string;
  state?: unknown;
  onClick?: () => void;
  disabled?: boolean;
  /**
   * 저장하는 동안. 눌러도 아무 일이 없지만 disabled 와 달리 초점을 놓지 않는다.
   * 표 안에서 누른 뒤 초점이 body 로 떨어지면 키보드 사용자가 자리를 잃는다
   */
  busy?: boolean;
  /** 그림을 돌린다. 만드는 중일 때 쓴다 */
  spin?: boolean;
  className?: string;
  'aria-expanded'?: boolean;
}

const VARIANT = {
  secondary: 'border border-accent-line bg-sheet text-ink hover:border-ink',
  ghost: 'text-ink2 hover:bg-surface hover:text-ink'
} as const;

export function IconButton({
  label,
  icon: Icon,
  variant = 'ghost',
  to,
  state,
  onClick,
  disabled,
  busy,
  spin,
  className,
  'aria-expanded': expanded
}: IconButtonProps) {
  const classes = cn(
    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-150 ease-snap disabled:cursor-not-allowed disabled:opacity-40',
    VARIANT[variant],
    className
  );
  const icon = <Icon className={cn('h-4 w-4', spin && 'animate-spin')} aria-hidden="true" />;
  if (to !== undefined)
  return (
    <Link to={to} state={state} aria-label={label} title={label} className={classes}>
        {icon}
      </Link>);

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-expanded={expanded}
      disabled={disabled}
      aria-disabled={busy || undefined}
      onClick={busy ? undefined : onClick}
      className={cn(classes, busy && 'cursor-wait opacity-40')}>

      {icon}
    </button>);

}
