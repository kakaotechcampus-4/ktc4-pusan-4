import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'inline';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary: 'border border-line bg-surface text-ink hover:bg-canvas',
  soft: 'bg-accent-soft text-accent hover:bg-accent-line',
  ghost: 'text-ink hover:text-accent'
};

/** sm은 헤더·표 안, md는 폼, lg는 랜딩 CTA, inline은 문장 속 텍스트 링크(ghost 전용) */
const SIZE: Record<ButtonSize, string> = {
  sm: 'rounded-lg px-4 py-2 text-body',
  md: 'rounded-xl px-5 py-3 text-body-lg',
  lg: 'rounded-xl px-7 py-3.5 text-lead',
  inline: 'text-body-lg'
};

const BASE =
'inline-flex items-center justify-center gap-1.5 font-semibold leading-normal transition-colors duration-150 ease-snap disabled:cursor-not-allowed disabled:opacity-50';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
}

type ButtonAsButton = CommonProps &
Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & {
  to?: undefined;
  href?: undefined;
};

type ButtonAsLink = CommonProps & {
  /** 라우터 링크. 내부 이동에 쓴다. */
  to: string;
  href?: undefined;
  replace?: boolean;
};

type ButtonAsAnchor = CommonProps &
Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children' | 'href'> & {
  /** 앵커·외부 링크 */
  href: string;
  to?: undefined;
};

export type ButtonProps = ButtonAsButton | ButtonAsLink | ButtonAsAnchor;

export function Button(props: ButtonProps) {
  const { variant = 'primary', size = 'md', className, children } = props;
  const classes = cn(BASE, VARIANT[variant], SIZE[size], className);

  if (props.to !== undefined) {
    const { to, replace } = props;
    return (
      <Link to={to} replace={replace} className={classes}>
        {children}
      </Link>);

  }
  if (props.href !== undefined) {
    const { variant: _v, size: _s, className: _c, children: _ch, ...rest } = props;
    return (
      <a className={classes} {...rest}>
        {children}
      </a>);

  }
  const { variant: _v, size: _s, className: _c, children: _ch, ...rest } = props;
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>);

}
