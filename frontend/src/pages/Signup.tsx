import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CheckIcon, ChevronRightIcon } from 'lucide-react';
import { SignedUpError, useSession } from '../contexts/SessionContext';
import { api, ApiRequestError, mockVerificationCode } from '../api';
import {
  AUTH_FIELD_ERROR,
  AUTH_INPUT,
  AUTH_LABEL,
  AuthLayout } from
'../components/AuthLayout';
import { Button, IconButton, Modal } from '../components/ui';
import { TERMS_EFFECTIVE, TermsBody } from './public/Terms';
import { PRIVACY_EFFECTIVE, PrivacyBody } from './public/Privacy';
import { PASSWORD_RULE, passwordProblem } from '../utils/password';
import { PasswordCheck } from '../components/PasswordCheck';
import { KakaoStart } from '../components/KakaoStart';

/** 다시 받기 간격. 서버도 60초에 한 번만 보낸다 (#193) */
const RESEND_SECONDS = 60;
/** 서버는 코드 하나에 5번까지 받고, 5번째로 틀리면 코드를 지운다. 그래도 응답은 「틀림」이라 여기서 센다 (C69) */
const MAX_CODE_ATTEMPTS = 5;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LocationState {
  from?: string;
}

/** 서버 문장은 띄우지 않고 code 로 고른다. 모르는 code 는 일반 문구다 */
const describe = (caught: unknown, table: Record<string, string>, fallback: string) => {
  if (!(caught instanceof ApiRequestError)) return fallback;
  if (caught.status === 0) return '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  return table[caught.code] ?? fallback;
};

const REQUEST_ERRORS: Record<string, string> = {
  VALIDATION_ERROR: '이메일 형식을 확인해 주세요.',
  EMAIL_ALREADY_EXISTS: '이미 가입한 이메일입니다. 로그인해 주세요.',
  VERIFICATION_DAILY_LIMIT: '오늘은 이 이메일로 코드를 더 받을 수 없습니다. 내일 다시 시도해 주세요.',
  EMAIL_VERIFICATION_UNAVAILABLE: '지금은 이메일 가입을 할 수 없습니다. 카카오로 시작해 주세요.'
};
/** 이메일 칸을 빨갛게 칠할 오류. 연결 실패처럼 칸 탓이 아닌 것은 칠하지 않는다 */
const EMAIL_FIELD_CODES = new Set(['VALIDATION_ERROR', 'EMAIL_ALREADY_EXISTS']);

const CONFIRM_ERRORS: Record<string, string> = {
  VALIDATION_ERROR: '숫자 6자리를 입력해 주세요.',
  VERIFICATION_CODE_EXPIRED: '코드를 더 쓸 수 없습니다. 코드를 다시 받아 주세요.'
};

const SIGNUP_ERRORS: Record<string, string> = {
  VALIDATION_ERROR: `비밀번호는 ${PASSWORD_RULE}로 입력해 주세요.`,
  EMAIL_ALREADY_EXISTS: '이미 가입한 이메일입니다. 로그인해 주세요.'
};

/** 429 VERIFICATION_RESEND_TOO_SOON 은 남은 초를 message 에만 담는다. 숫자를 못 찾으면 60초로 본다 */
const secondsLeft = (message: string) => {
  const found = /(\d+)\s*초/.exec(message);
  return found ? Number(found[1]) : RESEND_SECONDS;
};

/**
 * 코드를 보낸 이메일과 인증 토큰. 새로고침이나 뒤로 가기로 화면이 다시 떠도 이어 가게 탭 안에 둔다 (C69).
 * 인증 토큰은 서버에서 30분 뒤 끝나고, 그때는 EMAIL_NOT_VERIFIED 로 인증부터 다시 한다
 */
const PROGRESS_KEY = 'signup-progress';
interface Progress {
  sentTo: string;
  verificationToken: string | null;
}

const loadProgress = (): Progress | null => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(PROGRESS_KEY) ?? 'null') as Partial<Progress> | null;
    if (typeof saved?.sentTo !== 'string') return null;
    return {
      sentTo: saved.sentTo,
      verificationToken: typeof saved.verificationToken === 'string' ? saved.verificationToken : null
    };
  } catch {
    return null;
  }
};

const saveProgress = (progress: Progress | null) => {
  try {
    if (progress) sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    else sessionStorage.removeItem(PROGRESS_KEY);
  } catch {
    // 저장소를 막아 둔 브라우저다. 새로고침하면 처음부터 한다
  }
};

/** 오류가 어느 칸 때문인지. 그 칸 테두리를 빨갛게 하고 문구를 칸 바로 아래 둔다 (C91) */
type ErrorField = 'email' | 'code' | 'password' | 'passwordAgain' | 'terms' | null;

/**
 * 이메일 가입 (#193). 인증 코드 받기 → 6자리 코드 확인 → 비밀번호와 약관 동의 → 가입.
 * 가입하면 바로 로그인되고 사업자 문진으로 간다(「나중에 하기」로 건너뛸 수 있다)
 */
export function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, signUp } = useSession();
  const from = (location.state as LocationState | null)?.from;

  const [restored] = useState(loadProgress);
  const [email, setEmail] = useState(restored?.sentTo ?? '');
  /** 코드를 보낸 이메일. 보낸 뒤에는 이메일 칸을 잠근다 */
  const [sentTo, setSentTo] = useState<string | null>(restored?.sentTo ?? null);
  const [code, setCode] = useState('');
  /** 지금 코드로 틀린 횟수 */
  const [misses, setMisses] = useState(0);
  const [verificationToken, setVerificationToken] = useState<string | null>(restored?.verificationToken ?? null);
  const [password, setPassword] = useState('');
  const [passwordAgain, setPasswordAgain] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  /** 띄워 둔 문서. null 이면 닫혀 있다 */
  const [doc, setDoc] = useState<'terms' | 'privacy' | null>(null);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<ErrorField>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** 연타로 두 번 보내지 않게 막는다. busy 는 다음 렌더에야 반영된다 */
  const sending = useRef(false);
  /** 이 화면에서 가입하는 중이다. 가입이 끝나면 「이미 로그인했다」로 보내지 않고 문진으로 간다 */
  const signingUp = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((left) => left - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    saveProgress(sentTo ? { sentTo, verificationToken } : null);
  }, [sentTo, verificationToken]);

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

  /** 틀렸다고 한 비밀번호 칸을 고치기 시작하면 그 오류는 걷는다. 그래야 규칙 확인(PasswordCheck)이 다시 보인다 */
  const editPassword = (field: 'password' | 'passwordAgain', set: (value: string) => void) => (event: React.ChangeEvent<HTMLInputElement>) => {
    set(event.target.value);
    if (errorField === field) {
      setError(null);
      setErrorField(null);
    }
  };

  /** 새 코드를 보냈다(보냈을 수 있다). 코드 칸과 틀린 횟수를 새로 시작한다 */
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
      await api.auth.requestEmailVerification({ email: target });
      codeSent(target);
      setNotice(`${target} 주소로 인증 코드를 보냈습니다. 코드는 5분 동안 쓸 수 있습니다.`);
    } catch (caught) {
      const failed = caught instanceof ApiRequestError ? caught.code : '';
      if (failed === 'VERIFICATION_RESEND_TOO_SOON') {
        // 새로고침했거나 보내지 못했다고 들은 뒤 다시 요청한 경우다. 받은 코드가 있으면 그대로 쓰면 된다
        setSentTo(target);
        setCooldown(secondsLeft((caught as ApiRequestError).message));
        setNotice('이미 보낸 코드가 있습니다. 받은 코드를 입력하거나, 잠시 뒤 새 코드를 받아 주세요.');
        return;
      }
      if (failed === 'EMAIL_SEND_FAILED') {
        // 서버는 코드를 지우지 않는다. 타임아웃이면 메일이 실제로 갔을 수 있고, 다시 받기는 60초 뒤에만 된다 (C65)
        codeSent(target);
        setError('메일을 보내지 못했을 수 있습니다. 1분 안에 오지 않으면 코드를 다시 받아 주세요.');
        return;
      }
      const message = describe(caught, REQUEST_ERRORS, '코드를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.');
      if (EMAIL_FIELD_CODES.has(failed)) invalid('email', message);
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
        const confirmed = await api.auth.confirmEmailVerification({ email: sentTo, code });
        setVerificationToken(confirmed.verificationToken);
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

  /** 받은 코드와 인증을 버리고 이메일 단계로 돌아간다 */
  const resetVerification = () => {
    setSentTo(null);
    setVerificationToken(null);
    setCode('');
    setMisses(0);
    setCooldown(0);
    setNotice(null);
    setError(null);
    setErrorField(null);
  };

  /** 다른 이메일로 바꾼다. 앞 이메일로 적던 비밀번호도 남기지 않는다 */
  const changeEmail = () => {
    resetVerification();
    setPassword('');
    setPasswordAgain('');
  };

  const submitSignup = (event: React.FormEvent) => {
    event.preventDefault();
    if (!sentTo || !verificationToken) return;
    const problem = passwordProblem(password);
    if (problem) {
      invalid('password', problem);
      return;
    }
    if (password !== passwordAgain) {
      invalid('passwordAgain', '비밀번호가 서로 다릅니다.');
      return;
    }
    if (!agreeTerms || !agreePrivacy) {
      invalid('terms', '필수 약관에 동의해 주세요.');
      return;
    }
    void run(async () => {
      signingUp.current = true;
      try {
        await signUp({ email: sentTo, password, verificationToken });
        saveProgress(null);
        navigate('/interview', { replace: true, state: { welcome: true, from } });
      } catch (caught) {
        signingUp.current = false;
        if (caught instanceof SignedUpError) {
          saveProgress(null);
          setError('가입은 마쳤지만 로그인하지 못했습니다. 아래 로그인에서 가입한 이메일로 로그인해 주세요.');
          return;
        }
        if (caught instanceof ApiRequestError && caught.code === 'EMAIL_NOT_VERIFIED') {
          // 토큰이 30분을 넘겼거나 다른 이메일 것이다. 인증부터 다시 한다
          resetVerification();
          setError('이메일 인증이 만료됐습니다. 인증 코드를 다시 받아 주세요.');
          return;
        }
        // 비밀번호 규칙을 어기면 서버가 이유를 message 에 담는다. 그 문장을 그대로 보인다
        if (caught instanceof ApiRequestError && caught.code === 'VALIDATION_ERROR') {
          invalid('password', caught.message);
          return;
        }
        setError(describe(caught, SIGNUP_ERRORS, '가입하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
      }
    });
  };

  // 이미 로그인했으면 로그인 뒤에 갈 곳으로 보낸다 (C52). 이어 가는 중에는 폼을 그리지 않는다
  if (status === 'signedIn' && !signingUp.current) return <Navigate to={from ?? '/'} replace />;
  if (status === 'restoring') return <AuthLayout title="회원가입">{null}</AuthLayout>;

  const step = verificationToken ? 3 : sentTo ? 2 : 1;
  /** 그 칸 바로 아래 둘 오류. 칸이 정해지지 않은 오류는 field 를 null 로 불러 그 자리에 둔다 */
  const errorAt = (field: ErrorField) =>
  error && errorField === field &&
  <p id={field ? `signup-${field}-error` : undefined} role="alert" className={AUTH_FIELD_ERROR}>
        {error}
      </p>;

  const describedBy = (field: Exclude<ErrorField, null>) =>
  error && errorField === field ? `signup-${field}-error` : undefined;

  return (
    <AuthLayout title="회원가입">
      <h1 className="text-[26px] font-bold tracking-tight text-ink">
        회원가입
      </h1>

      <KakaoStart from={from ?? '/'} label="카카오로 시작하기" divider="또는 이메일로" disabled={busy} />

      <ol className="mt-6 flex gap-2 text-[12px]" aria-label="가입 단계">
        {['이메일 인증', '코드 확인', '비밀번호'].map((label, index) =>
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
        <label htmlFor="signup-email" className={AUTH_LABEL}>
          이메일
        </label>
        <div className="flex items-center gap-2">
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            value={sentTo ?? email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={sentTo !== null}
            placeholder="name@example.com"
            aria-invalid={errorField === 'email'}
            aria-describedby={describedBy('email')}
            className={AUTH_INPUT} />

          {verificationToken &&
          <span className="mt-1.5 flex shrink-0 items-center gap-1 text-[13px] font-bold text-ink">
              <CheckIcon className="h-4 w-4" aria-hidden="true" />
              인증됨
            </span>
          }
        </div>
        {sentTo === null ?
        <>
            {errorAt('email')}
            {errorAt(null)}
            <Button type="submit" disabled={busy} className="mt-4 w-full">
              {busy ? '보내는 중' : '인증 코드 받기'}
            </Button>
          </> :

        <button
          type="button"
          onClick={changeEmail}
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
          <label htmlFor="signup-code" className={AUTH_LABEL}>
            인증 코드
          </label>
          {/*
            maxLength 를 두면 앞에 공백이 붙은 채 붙여 넣을 때 숫자만 남기기 전에 잘려 마지막 자리를 잃는다 (C69).
            자간은 값이 있을 때만 준다. placeholder 까지 벌어진다
          */}
          <input
          id="signup-code"
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
              목업 인증 코드는 {mockVerificationCode} 입니다.
            </p>
        }
          <Button type="submit" disabled={busy} className="mt-4 w-full">
            {busy ? '확인 중' : '코드 확인'}
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
      <form onSubmit={submitSignup} noValidate className="mt-5">
          <div className="space-y-3">
            <div>
              {/* 조건은 placeholder 가 아니라 라벨에 둔다. placeholder 는 적기 시작하면 사라진다 (C70) */}
              <label htmlFor="signup-password" className={AUTH_LABEL}>
                비밀번호 ({PASSWORD_RULE})
              </label>
              <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={editPassword('password', setPassword)}
              aria-invalid={errorField === 'password'}
              aria-describedby={describedBy('password') ?? (password ? 'signup-password-check' : undefined)}
              className={AUTH_INPUT} />

              {errorAt('password')}
              <PasswordCheck id="signup-password-check" password={password} hidden={errorField === 'password'} />
            </div>
            <div>
              <label htmlFor="signup-password-again" className={AUTH_LABEL}>
                비밀번호 확인
              </label>
              <input
              id="signup-password-again"
              type="password"
              autoComplete="new-password"
              value={passwordAgain}
              onChange={editPassword('passwordAgain', setPasswordAgain)}
              aria-invalid={errorField === 'passwordAgain'}
              aria-describedby={describedBy('passwordAgain')}
              className={AUTH_INPUT} />

              {errorAt('passwordAgain')}
            </div>
          </div>

          <fieldset
          aria-describedby={describedBy('terms')}
          className={`mt-5 space-y-2 rounded-xl border px-3.5 py-3 text-[13px] ${
          errorField === 'terms' ? 'border-deny' : 'border-line'}`
          }>

            <legend className="sr-only">약관 동의</legend>
            <label htmlFor="agree-all" className="flex items-center gap-2 font-bold text-ink">
              <input
              id="agree-all"
              type="checkbox"
              checked={agreeTerms && agreePrivacy}
              onChange={(event) => {
                setAgreeTerms(event.target.checked);
                setAgreePrivacy(event.target.checked);
              }} />

              모두 동의합니다
            </label>
            <span aria-hidden="true" className="block h-px bg-line2" />
            {/*
              「보기」는 label 밖에 둔다. 안에 두면 누를 때 체크박스까지 같이 켜진다 —
              읽어 보려다 동의한 것이 되면 안 된다 (#247 리뷰)
            */}
            <div className="flex items-center gap-2 text-ink2">
              <label htmlFor="agree-terms" className="flex flex-1 items-center gap-2">
                <input id="agree-terms" type="checkbox" checked={agreeTerms} onChange={(event) => setAgreeTerms(event.target.checked)} />
                [필수] 이용약관 동의
              </label>
              <IconButton icon={ChevronRightIcon} label="이용약관 보기" onClick={() => setDoc('terms')} />
            </div>
            <div className="flex items-center gap-2 text-ink2">
              <label htmlFor="agree-privacy" className="flex flex-1 items-center gap-2">
                <input
                  id="agree-privacy"
                  type="checkbox"
                  checked={agreePrivacy}
                  onChange={(event) => setAgreePrivacy(event.target.checked)} />

                [필수] 개인정보 수집 및 이용 동의
              </label>
              <IconButton icon={ChevronRightIcon} label="개인정보 수집 및 이용 동의 보기" onClick={() => setDoc('privacy')} />
            </div>
          </fieldset>
          {errorAt('terms')}

          {/* 페이지로 보내지 않고 창으로 띄운다. 적던 메일·비밀번호를 잃지 않는다 (#247 리뷰) */}
          <Modal
            open={doc !== null}
            onClose={() => setDoc(null)}
            size="lg"
            title={doc === 'privacy' ? '개인정보처리방침' : '이용약관'}
            description={`시행일 ${doc === 'privacy' ? PRIVACY_EFFECTIVE : TERMS_EFFECTIVE}`}
            footer={
            <Button variant="secondary" size="sm" onClick={() => setDoc(null)}>
                닫기
              </Button>
            }>

            {doc === 'privacy' ? <PrivacyBody /> : <TermsBody onOpenPrivacy={() => setDoc('privacy')} />}
          </Modal>

          {errorAt(null)}
          <Button type="submit" disabled={busy} className="mt-5 w-full">
            {busy ? '가입하는 중' : '가입하기'}
          </Button>
        </form>
      }

      <p className="mt-6 text-center text-[13px] text-ink2">
        계정이 있으면{' '}
        <Link
          to="/login"
          state={from ? { from } : undefined}
          className="font-bold text-ink underline underline-offset-4 decoration-accent-line hover:decoration-ink">

          로그인
        </Link>
      </p>
    </AuthLayout>);

}
