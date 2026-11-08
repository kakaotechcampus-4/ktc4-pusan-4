import React, { useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';
import { ApiRequestError, isMock, mockPassword } from '../api';
import { AUTH_FIELD_ERROR, AUTH_INPUT, AUTH_LABEL, AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/ui';
import { kakaoAvailable } from '../auth/kakao';
import { KakaoStart } from '../components/KakaoStart';
import type { SessionEndReason } from '../auth/session';

interface LocationState {
  from?: string;
  /** RequireAuth 가 넘긴다. 로그인이 저절로 끝났을 때만 있다 */
  reason?: SessionEndReason | null;
  /** 비밀번호 재설정(PasswordReset)이나 변경(Account)을 마치고 왔다. 새 비밀번호로 다시 들어간다 */
  passwordReset?: boolean;
  passwordChanged?: boolean;
  /** 재설정한 이메일. 이메일 칸에 채워 둔다 */
  email?: string;
}

/** 로그인이 왜 끝났는지 한 줄로 알린다 (C51·C44·C45) */
const ENDED: Record<SessionEndReason, string> = {
  expired: '로그인이 만료됐습니다. 다시 로그인해 주세요.',
  'account-changed': '다른 탭에서 다른 계정으로 로그인해 이 탭은 로그아웃했습니다.',
  'signed-out': '다른 탭에서 로그아웃했습니다.'
};

/** 오류가 어느 칸 때문인지. 서버 오류는 칸을 빨갛게 칠하지 않고 버튼 위에 둔다 (C91) */
type ErrorField = 'email' | 'password' | null;

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, signIn } = useSession();
  const [email, setEmail] = useState((location.state as LocationState | null)?.email ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<ErrorField>(null);
  const [busy, setBusy] = useState(false);
  /** 이 화면에서 로그인하는 중이다. 로그인이 끝나면 아래 「이미 로그인했다」로 보내지 않고 complete 가 보낸다 */
  const signingIn = useRef(false);

  const state = location.state as LocationState | null;
  const from = state?.from ?? '/';
  const ended = state?.reason ?
  ENDED[state.reason] :
  state?.passwordReset || state?.passwordChanged ?
  '비밀번호를 바꿨습니다. 새 비밀번호로 로그인해 주세요.' :
  null;

  // 서버 문장은 그대로 띄우지 않는다. code 로 고른다 (api.md 1.1)
  const complete = async (nextEmail: string, nextPassword: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setErrorField(null);
    signingIn.current = true;
    try {
      await signIn(nextEmail, nextPassword);
      navigate(from, { replace: true });
    } catch (caught) {
      signingIn.current = false;
      const code = caught instanceof ApiRequestError ? caught.code : '';
      const offline = caught instanceof ApiRequestError && caught.status === 0;
      setError(
        code === 'INVALID_CREDENTIALS' ?
        '이메일 또는 비밀번호를 확인해 주세요.' :
        offline ?
        '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' :
        '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.'
      );
      setBusy(false);
    }
  };

  const invalid = (field: ErrorField, message: string) => {
    setError(message);
    setErrorField(field);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.includes('@')) {
      invalid('email', '이메일 형식을 확인해 주세요.');
      return;
    }
    // 길이 규칙은 가입할 때만 본다. 가입 전에 만든 계정의 비밀번호를 여기서 막지 않는다
    if (password === '') {
      invalid('password', '비밀번호를 입력해 주세요.');
      return;
    }
    void complete(email, password);
  };

  // 이미 로그인했으면 로그인 뒤에 갈 곳으로 보낸다 (C52). 이어 가는 중에는 폼을 그리지 않는다 — 그렸다가 바로 넘어가면 깜빡인다
  if (status === 'signedIn' && !signingIn.current) return <Navigate to={from} replace />;
  if (status === 'restoring') return <AuthLayout title="로그인">{null}</AuthLayout>;

  const fieldError = (field: ErrorField) =>
  error && errorField === field &&
  <p id={`login-${field}-error`} role="alert" className={AUTH_FIELD_ERROR}>
        {error}
      </p>;


  return (
    <AuthLayout title="로그인">
      <h1 className="text-[26px] font-bold tracking-tight text-ink">
        로그인
      </h1>
      {ended &&
      <p role="status" className="mt-3 text-[14px] leading-6 text-ink">
          {ended}
        </p>
      }

      <KakaoStart from={from} label="카카오로 계속하기" divider="또는 이메일로" disabled={busy} />

      <form onSubmit={submit} noValidate className={kakaoAvailable ? undefined : 'mt-8'}>
        <div className="space-y-3">
          <div>
            <label htmlFor="email" className={AUTH_LABEL}>
              이메일
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              aria-invalid={errorField === 'email'}
              aria-describedby={errorField === 'email' ? 'login-email-error' : undefined}
              className={AUTH_INPUT} />

            {fieldError('email')}
          </div>
          <div>
            <label htmlFor="password" className={AUTH_LABEL}>
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={errorField === 'password'}
              aria-describedby={errorField === 'password' ? 'login-password-error' : undefined}
              className={AUTH_INPUT} />

            {fieldError('password')}
            <Link
              to="/password-reset"
              state={email.includes('@') ? { email } : undefined}
              className="mt-2 inline-block text-[12px] text-ink2 underline underline-offset-4 hover:text-ink">

              비밀번호 재설정
            </Link>
          </div>
        </div>

        {error && errorField === null &&
        <p role="alert" className="mt-3 text-[13px] text-deny">
            {error}
          </p>
        }

        <Button type="submit" disabled={busy} className="mt-5 w-full">
          {busy ? '로그인 중' : '로그인'}
        </Button>
      </form>

      <p className="mt-4 text-center text-[13px] text-ink2">
        계정이 없으면{' '}
        <Link
          to="/signup"
          state={{ from }}
          className="font-bold text-ink underline underline-offset-4 decoration-accent-line hover:decoration-ink">

          이메일로 가입하기
        </Link>
      </p>

      {isMock &&
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => void complete('demo@expense-verdict.kr', mockPassword ?? '')}
        className="mt-3 w-full">

          샘플 계정으로 둘러보기
        </Button>
      }

      {isMock &&
      <p className="mt-2 text-[12px] leading-6 text-muted">
          목업 비밀번호는 {mockPassword} 입니다. admin@ 으로 시작하는 이메일은 관리자로 들어갑니다.
        </p>
      }
    </AuthLayout>);

}
