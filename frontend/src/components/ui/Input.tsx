import React from 'react';
import { cn } from './cn';

const FIELD =
'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-body text-ink placeholder:text-muted disabled:bg-canvas disabled:text-muted';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(FIELD, className)} {...rest} />;
  });


export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cn(FIELD, className)} {...rest}>
        {children}
      </select>);

  });


interface FieldProps {
  label: React.ReactNode;
  htmlFor: string;
  /** 라벨 아래 보조 설명 */
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
}

/** 라벨 + 힌트 + 입력 + 오류를 한 덩어리로 */
export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-body-lg font-semibold text-ink">
        {label}
      </label>
      {hint && <p className="mt-1 text-small text-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
      {error &&
      <p role="alert" className="mt-2 text-small text-deny">
          {error}
        </p>
      }
    </div>);

}
