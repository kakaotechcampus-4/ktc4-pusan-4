import React from 'react';
import { cn } from './cn';

/**
 * 흰 바탕에 edge 테두리(흰 바탕 3.44). 잘못 넣은 칸은 aria-invalid 를 걸면 테두리가 deny 로 바뀐다 —
 * 오류 문구(Field 의 error)와 같이 쓴다. placeholder 는 muted(5.44)라 읽히지만, 지켜야 할 조건은 placeholder 에만 두지 않는다
 */
const FIELD =
'w-full rounded-xl border border-edge bg-canvas px-3.5 py-2.5 text-body text-ink placeholder:text-muted aria-[invalid=true]:border-deny disabled:cursor-not-allowed disabled:border-line disabled:text-muted';

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
      <label htmlFor={htmlFor} className="text-body-lg font-bold text-ink">
        {label}
      </label>
      {hint && <p className="mt-1 text-small text-ink2">{hint}</p>}
      <div className="mt-3">{children}</div>
      {error &&
      <p role="alert" className="mt-2 text-small text-deny">
          {error}
        </p>
      }
    </div>);

}
