import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiRequestError } from '../api';
import { useSession } from '../contexts/SessionContext';
import { AUTH_FIELD_ERROR, AUTH_INPUT, AUTH_LABEL } from './AuthLayout';
import { PasswordCheck } from './PasswordCheck';
import { Button } from './ui';
import { PASSWORD_RULE, passwordProblem } from '../utils/password';

type Field = 'current' | 'next' | 'again' | null;

/**
 * 내 정보의 비밀번호 바꾸기 (api.md 3.1 PUT /users/me/password).
 * 바꾸면 서버가 지금 기기를 포함한 모든 로그인을 끊는다. 로그아웃하고 로그인 화면으로 보낸다.
 * 카카오 계정은 비밀번호가 없어 폼을 열지 않는다
 */
export function PasswordChange({ email }: {email: string | null;}) {
  const navigate = useNavigate();
  const { signOut } = useSession();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<Field>(null);
  /** 서버가 비밀번호 없는 계정이라고 했다. 이메일이 있어도 카카오로만 들어오는 계정이다 */
  const [noPassword, setNoPassword] = useState(false);
  const sending = useRef(false);

  const invalid = (at: Field, message: string) => {
    setError(message);
    setField(at);
  };

  const close = () => {
    setOpen(false);
    setCurrent('');
    setNext('');
    setAgain('');
    setError(null);
    setField(null);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (sending.current) return;
    if (current === '') {
      invalid('current', '지금 비밀번호를 입력해 주세요.');
      return;
    }
    const problem = passwordProblem(next);
    if (problem) {
      invalid('next', problem);
      return;
    }
    if (next !== again) {
      invalid('again', '새 비밀번호가 서로 다릅니다.');
      return;
    }
    sending.current = true;
    setBusy(true);
    setError(null);
    setField(null);
    void api.users.changePassword({ currentPassword: current, newPassword: next }).then(
      () => {
        // 서버가 모든 로그인을 끊었다. 이 기기의 쿠키도 지우고(signOut 이 /auth/logout 을 부른다) 새 비밀번호로 들어오게 한다
        signOut();
        navigate('/login', { replace: true, state: { passwordChanged: true, email } });
      },
      (caught: unknown) => {
        sending.current = false;
        setBusy(false);
        const code = caught instanceof ApiRequestError ? caught.code : '';
        if (code === 'INVALID_CURRENT_PASSWORD') invalid('current', '지금 비밀번호가 맞지 않습니다.');
        // 규칙을 어기면 서버가 이유를 message 에 담는다
        else if (code === 'VALIDATION_ERROR') invalid('next', (caught as ApiRequestError).message);
        else if (code === 'PASSWORD_NOT_SET') {
          close();
          setNoPassword(true);
        } else
        invalid(
          null,
          caught instanceof ApiRequestError && caught.status === 0 ?
          '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' :
          '비밀번호를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.'
        );
      }
    );
  };

  const errorAt = (at: Field) =>
  error && field === at &&
  <p id={at ? `password-${at}-error` : undefined} role="alert" className={AUTH_FIELD_ERROR}>
        {error}
      </p>;
  const describedBy = (at: Exclude<Field, null>) => error && field === at ? `password-${at}-error` : undefined;

  if (email === null || noPassword)
  return (
    <p className="mt-1.5 text-body leading-6 text-ink">
        카카오로 로그인한 계정이라 비밀번호가 없습니다.
      </p>);

  if (!open)
  return (
    <Button variant="secondary" size="md" className="mt-4" onClick={() => setOpen(true)}>
        비밀번호 바꾸기
      </Button>);

  return (
    <form onSubmit={submit} noValidate className="mt-4 max-w-sm space-y-3">
      <div>
        <label htmlFor="password-current" className={AUTH_LABEL}>
          지금 비밀번호
        </label>
        <input
          id="password-current"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          aria-invalid={field === 'current'}
          aria-describedby={describedBy('current')}
          className={AUTH_INPUT} />

        {errorAt('current')}
      </div>
      <div>
        <label htmlFor="password-next" className={AUTH_LABEL}>
          새 비밀번호 ({PASSWORD_RULE})
        </label>
        <input
          id="password-next"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
          aria-invalid={field === 'next'}
          aria-describedby={describedBy('next') ?? (next ? 'password-next-check' : undefined)}
          className={AUTH_INPUT} />

        {errorAt('next')}
        <PasswordCheck id="password-next-check" password={next} hidden={field === 'next'} />
      </div>
      <div>
        <label htmlFor="password-again" className={AUTH_LABEL}>
          새 비밀번호 확인
        </label>
        <input
          id="password-again"
          type="password"
          autoComplete="new-password"
          value={again}
          onChange={(event) => setAgain(event.target.value)}
          aria-invalid={field === 'again'}
          aria-describedby={describedBy('again')}
          className={AUTH_INPUT} />

        {errorAt('again')}
      </div>
      {errorAt(null)}
      <p className="text-small leading-6 text-ink2">바꾸면 모든 기기에서 로그아웃합니다.</p>
      <div className="flex gap-2">
        <Button type="submit" size="md" disabled={busy}>
          {busy ? '바꾸는 중…' : '바꾸기'}
        </Button>
        <Button variant="secondary" size="md" disabled={busy} onClick={close}>
          취소
        </Button>
      </div>
    </form>);

}
