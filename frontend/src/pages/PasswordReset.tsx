import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, ApiRequestError, mockVerificationCode } from '../api';
import { AUTH_FIELD_ERROR, AUTH_INPUT, AUTH_LABEL, AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/ui';
import { PasswordCheck } from '../components/PasswordCheck';
import { PASSWORD_RULE, passwordProblem } from '../utils/password';
import { SUPPORT_EMAIL } from '../utils/contact';

/** 다시 받기 간격과 코드 하나에 틀릴 수 있는 횟수. 가입 인증과 같다 (api.md 1.1) */
const RESEND_SECONDS = 60;
const MAX_CODE_ATTEMPTS = 5;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const OFFLINE = '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.';

const REQUEST_ERRORS: Record<string, string> = {
  VALIDATION_ERROR: '이메일 형식을 확인해 주세요.',
  VERIFICATION_DAILY_LIMIT: '오늘은 이 이메일로 코드를 더 받을 수 없습니다. 내일 다시 시도해 주세요.',
  EMAIL_VERIFICATION_UNAVAILABLE: `지금은 비밀번호를 재설정할 수 없습니다. ${SUPPORT_EMAIL} 주소로 가입한 이메일을 적어 보내 주세요.`
};

const CONFIRM_ERRORS: Record<string, string> = {
  VALIDATION_ERROR: '숫자 6자리를 입력해 주세요.',
  VERIFICATION_CODE_EXPIRED: '코드를 더 쓸 수 없습니다. 코드를 다시 받아 주세요.'
};

const describe = (caught: unknown, table: Record<string, string>, fallback: string) => {
  if (!(caught instanceof ApiRequestError)) return fallback;
  if (caught.status === 0) return OFFLINE;
  return table[caught.code] ?? fallback;
};

/** 429 VERIFICATION_RESEND_TOO_SOON 은 남은 초를 message 에만 담는다 */
const secondsLeft = (message: string) => {
  const found = /(\d+)\s*초/.exec(message);
  return found ? Number(found[1]) : RESEND_SECONDS;
};

type ErrorField = 'email' | 'code' | 'password' | 'passwordAgain' | null;

/** 로그인 화면이 넘긴다. 적어 둔 이메일을 그대로 쓴다 */
interface LocationState {
  email?: string;
}

/**
 * 비밀번호 재설정 (api.md 1.1). 이메일 → 6자리 코드 → 새 비밀번호. 가입 인증과 같은 모양이다.
 * 서버는 가입하지 않은 이메일에도 성공을 돌려줘 가입 여부를 드러내지 않는다. 화면도 「가입한 이메일이면」이라고만 한다.
 * 바꾸면 모든 로그인이 끊기고, 로그인 화면에서 새 비밀번호로 들어간다
 */
export function PasswordReset() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState((location.state as LocationState | null)?.email ?? '');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [misses, setMisses] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordAgain, setPasswordAgain] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<ErrorField>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const sending = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((left) => left - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const run = async (action: () => Promise<void>) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    setErrorField(null);
    try {
      await action();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const invalid = (field: ErrorField, message: string) => {
    setError(message);
    setErrorField(field);
  };

  const codeSent = (target: string) => {
    setSentTo(target);
    setCode('');
    setMisses(0);
    setCooldown(RESEND_SECONDS);
  };

  const requestCode = (target: string) =>
  run(async () => {
    setNotice(null);
    try {
      await api.auth.requestPasswordReset({ email: target });
      codeSent(target);
      setNotice(`가입한 이메일이면 ${target} 주소로 코드를 보냈습니다. 코드는 5분 동안 쓸 수 있습니다.`);
    } catch (caught) {
      const failed = caught instanceof ApiRequestError ? caught.code : '';
      if (failed === 'VERIFICATION_RESEND_TOO_SOON') {
        setSentTo(target);
        setCooldown(secondsLeft((caught as ApiRequestError).message));
        setNotice('이미 보낸 코드가 있습니다. 받은 코드를 입력하거나, 잠시 뒤 새 코드를 받아 주세요.');
        return;
      }
      if (failed === 'EMAIL_SEND_FAILED') {
        codeSent(target);
        setError('메일을 보내지 못했을 수 있습니다. 1분 안에 오지 않으면 코드를 다시 받아 주세요.');
        return;
      }
      const message = describe(caught, REQUEST_ERRORS, '코드를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.');
      if (failed === 'VALIDATION_ERROR') invalid('email', message);
      else setError(message);
    }
  });

  const submitEmail = (event: React.FormEvent) => {
    event.preventDefault();
    const target = email.trim();
    if (!EMAIL_PATTERN.test(target)) {
      invalid('email', '이메일 형식을 확인해 주세요.');
      return;
    }
    void requestCode(target);
  };

  const submitCode = (event: React.FormEvent) => {
    event.preventDefault();
    if (!sentTo) return;
    if (!/^\d{6}$/.test(code)) {
      invalid('code', '메일로 받은 숫자 6자리를 입력해 주세요.');
      return;
    }
    void run(async () => {
      try {
        const confirmed = await api.auth.confirmPasswordReset({ email: sentTo, code });
        setToken(confirmed.verificationToken);
        setNotice(null);
      } catch (caught) {
        if (caught instanceof ApiRequestError && caught.code === 'INVALID_VERIFICATION_CODE') {
          const missed = misses + 1;
          setMisses(missed);
          invalid(
            'code',
            missed >= MAX_CODE_ATTEMPTS ?
            `${MAX_CODE_ATTEMPTS}번 틀려 이 코드는 더 쓸 수 없습니다. 코드를 다시 받아 주세요.` :
            '코드가 맞지 않습니다. 다시 입력해 주세요.'
          );
          return;
        }
        const message = describe(caught, CONFIRM_ERRORS, '코드를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        if (caught instanceof ApiRequestError && caught.code === 'VALIDATION_ERROR') invalid('code', message);
        else setError(message);
      }
    });
  };

  /** 받은 코드와 토큰을 버리고 이메일 단계로 돌아간다 */
  const startOver = () => {
    setSentTo(null);
    setToken(null);
    setCode('');
    setMisses(0);
    setCooldown(0);
    setPassword('');
    setPasswordAgain('');
    setNotice(null);
    setError(null);
    setErrorField(null);
  };

  const submitPassword = (event: React.FormEvent) => {
    event.preventDefault();
    if (!sentTo || !token) return;
    const problem = passwordProblem(password);
    if (problem) {
      invalid('password', problem);
      return;
    }
    if (password !== passwordAgain) {
      invalid('passwordAgain', '비밀번호가 서로 다릅니다.');
      return;
    }
    void run(async () => {
      try {
        await api.auth.completePasswordReset({ email: sentTo, verificationToken: token, newPassword: password });
        navigate('/login', { replace: true, state: { passwordReset: true, email: sentTo } });
      } catch (caught) {
        if (caught instanceof ApiRequestError && caught.code === 'EMAIL_NOT_VERIFIED') {
          // 토큰이 30분을 넘겼거나 이미 썼다. 코드부터 다시 받는다
          startOver();
          setEmail(sentTo);
          setError('코드 확인이 만료됐습니다. 코드를 다시 받아 주세요.');
          return;
        }
        // 규칙을 어기면 서버가 이유를 message 에 담는다. 토큰은 그대로라 고쳐서 다시 보내면 된다
        if (caught instanceof ApiRequestError && caught.code === 'VALIDATION_ERROR') {
          invalid('password', caught.message);
          return;
        }
        setError(describe(caught, {}, '비밀번호를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.'));
      }
    });
  };

  const step = token ? 3 : sentTo ? 2 : 1;
  const errorAt = (field: ErrorField) =>
  error && errorField === field &&
  <p id={field ? `reset-${field}-error` : undefined} role="alert" className={AUTH_FIELD_ERROR}>
        {error}
      </p>;
  const describedBy = (field: Exclude<ErrorField, null>) =>
  error && errorField === field ? `reset-${field}-error` : undefined;

  return (
    <AuthLayout title="비밀번호 재설정">
      <h1 className="text-[26px] font-bold tracking-tight text-ink">
        비밀번호 재설정
      </h1>

      <ol className="mt-6 flex gap-2 text-[12px]" aria-label="재설정 단계">
        {['이메일', '코드 확인', '새 비밀번호'].map((label, index) =>
        <li
          key={label}
          aria-current={step === index + 1 ? 'step' : undefined}
          className={`flex-1 rounded-full px-2 py-1 text-center ${
          step === index + 1 ?
          'bg-accent font-bold text-white' :
          step > index + 1 ?
          'text-ink2' :
          'text-muted'}`
          }>

            {index + 1}. {label}
          </li>
        )}
      </ol>

      <form onSubmit={submitEmail} noValidate className="mt-6">
        <label htmlFor="reset-email" className={AUTH_LABEL}>
          가입한 이메일
        </label>
        <input
          id="reset-email"
          type="email"
          autoComplete="email"
          value={sentTo ?? email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={sentTo !== null}
          placeholder="name@example.com"
          aria-invalid={errorField === 'email'}
          aria-describedby={describedBy('email')}
          className={AUTH_INPUT} />

        {sentTo === null ?
        <>
            {errorAt('email')}
            {errorAt(null)}
            <Button type="submit" disabled={busy} className="mt-4 w-full">
              {busy ? '보내는 중…' : '코드 받기'}
            </Button>
          </> :

        <button
          type="button"
          onClick={startOver}
          disabled={busy}
          className="mt-2 text-[12px] text-ink2 underline underline-offset-4 hover:text-ink">

            다른 이메일로 바꾸기
          </button>
        }
      </form>

      {notice &&
      <p role="status" className="mt-4 text-[13px] leading-6 text-ink">
          {notice}
        </p>
      }

      {step === 2 &&
      <form onSubmit={submitCode} noValidate className="mt-5">
          <label htmlFor="reset-code" className={AUTH_LABEL}>
            코드
          </label>
          <input
          id="reset-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="숫자 6자리"
          aria-invalid={errorField === 'code'}
          aria-describedby={describedBy('code')}
          className={`${AUTH_INPUT} tabular-nums ${code ? 'tracking-[0.3em]' : ''}`} />

          {errorAt('code')}
          {errorAt(null)}
          {mockVerificationCode &&
        <p className="mt-2 text-[12px] leading-6 text-muted">
              목업 코드는 {mockVerificationCode} 입니다.
            </p>
        }
          <Button type="submit" disabled={busy} className="mt-4 w-full">
            {busy ? '확인 중…' : '코드 확인'}
          </Button>
          <Button
          variant="secondary"
          disabled={busy || cooldown > 0}
          onClick={() => sentTo && void requestCode(sentTo)}
          className="mt-2 w-full">

            {cooldown > 0 ? `코드 다시 받기 (${cooldown}초)` : '코드 다시 받기'}
          </Button>
          <p className="mt-2 text-[12px] leading-6 text-ink2">메일이 오지 않으면 스팸함을 확인해 주세요.</p>
        </form>
      }

      {step === 3 &&
      <form onSubmit={submitPassword} noValidate className="mt-5">
          <div className="space-y-3">
            <div>
              <label htmlFor="reset-password" className={AUTH_LABEL}>
                새 비밀번호 ({PASSWORD_RULE})
              </label>
              <input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={errorField === 'password'}
              aria-describedby={describedBy('password') ?? (password ? 'reset-password-check' : undefined)}
              className={AUTH_INPUT} />

              {errorAt('password')}
              <PasswordCheck id="reset-password-check" password={password} hidden={errorField === 'password'} />
            </div>
            <div>
              <label htmlFor="reset-password-again" className={AUTH_LABEL}>
                새 비밀번호 확인
              </label>
              <input
              id="reset-password-again"
              type="password"
              autoComplete="new-password"
              value={passwordAgain}
              onChange={(event) => setPasswordAgain(event.target.value)}
              aria-invalid={errorField === 'passwordAgain'}
              aria-describedby={describedBy('passwordAgain')}
              className={AUTH_INPUT} />

              {errorAt('passwordAgain')}
            </div>
          </div>
          {errorAt(null)}
          <Button type="submit" disabled={busy} className="mt-5 w-full">
            {busy ? '바꾸는 중…' : '비밀번호 바꾸기'}
          </Button>
        </form>
      }

      <p className="mt-6 text-center text-[13px] text-ink2">
        비밀번호가 생각나면{' '}
        <Link
          to="/login"
          className="font-bold text-ink underline underline-offset-4 decoration-accent-line hover:decoration-ink">

          로그인
        </Link>
      </p>
    </AuthLayout>);

}
