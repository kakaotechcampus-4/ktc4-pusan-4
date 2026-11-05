import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckIcon } from 'lucide-react';
import { SignedUpError, useSession } from '../contexts/SessionContext';
import { api, ApiRequestError, mockVerificationCode } from '../api';
import { AUTH_INPUT, AUTH_LABEL, AUTH_PRIMARY, AUTH_SECONDARY, AuthLayout } from '../components/AuthLayout';
import { Button, Modal } from '../components/ui';
import { TERMS_EFFECTIVE, TermsBody } from './public/Terms';
import { PRIVACY_EFFECTIVE, PrivacyBody } from './public/Privacy';

/** 다시 받기 간격. 서버도 60초에 한 번만 보낸다 (#193) */
const RESEND_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** 약관·처리방침을 여는 「보기」 */
const DOC_LINK = 'shrink-0 text-[12px] text-muted underline underline-offset-4 hover:text-ink';

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
  EMAIL_SEND_FAILED: '메일을 보내지 못했습니다. 다시 요청해 주세요.',
  EMAIL_VERIFICATION_UNAVAILABLE: '지금은 이메일 가입을 할 수 없습니다. 카카오로 시작해 주세요.'
};

const CONFIRM_ERRORS: Record<string, string> = {
  VALIDATION_ERROR: '숫자 6자리를 입력해 주세요.',
  INVALID_VERIFICATION_CODE: '코드가 맞지 않습니다. 다시 입력해 주세요.',
  VERIFICATION_CODE_EXPIRED: '코드를 더 쓸 수 없습니다. 코드를 다시 받아 주세요.'
};

const SIGNUP_ERRORS: Record<string, string> = {
  VALIDATION_ERROR: '비밀번호는 8자 이상, 72바이트 이하로 입력해 주세요.',
  EMAIL_ALREADY_EXISTS: '이미 가입한 이메일입니다. 로그인해 주세요.'
};

/** 429 VERIFICATION_RESEND_TOO_SOON 은 남은 초를 message 에만 담는다. 숫자를 못 찾으면 60초로 본다 */
const secondsLeft = (message: string) => {
  const found = /(\d+)\s*초/.exec(message);
  return found ? Number(found[1]) : RESEND_SECONDS;
};

/** bcrypt 한도 때문에 서버는 UTF-8 72바이트까지만 받는다 */
const byteLength = (text: string) => new TextEncoder().encode(text).length;

/**
 * 이메일 가입 (#193). 인증 코드 받기 → 6자리 코드 확인 → 비밀번호와 약관 동의 → 가입.
 * 가입하면 바로 로그인되고 사업자 문진으로 간다(「나중에 하기」로 건너뛸 수 있다)
 */
export function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signUp } = useSession();
  const from = (location.state as LocationState | null)?.from;

  const [email, setEmail] = useState('');
  /** 코드를 보낸 이메일. 보낸 뒤에는 이메일 칸을 잠근다 */
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordAgain, setPasswordAgain] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  /** 띄워 둔 문서. null 이면 닫혀 있다 */
  const [doc, setDoc] = useState<'terms' | 'privacy' | null>(null);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 지금 오류가 비밀번호 칸 때문인지. 약관·서버 오류에 비밀번호 칸을 빨갛게 칠하지 않는다 */
  const [passwordError, setPasswordError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** 연타로 두 번 보내지 않게 막는다. busy 는 다음 렌더에야 반영된다 */
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
    try {
      await action();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const requestCode = (target: string) =>
  run(async () => {
    setNotice(null);
    try {
      await api.auth.requestEmailVerification({ email: target });
      setSentTo(target);
      setCode('');
      setCooldown(RESEND_SECONDS);
      setNotice(`${target} 주소로 인증 코드를 보냈습니다. 코드는 5분 동안 쓸 수 있습니다.`);
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.code === 'VERIFICATION_RESEND_TOO_SOON') {
        // 새로고침 뒤 다시 요청한 경우다. 이미 보낸 코드를 그대로 쓰면 된다
        setSentTo(target);
        setCooldown(secondsLeft(caught.message));
        setNotice('방금 보낸 코드가 있습니다. 메일함을 확인해 주세요.');
        return;
      }
      setError(describe(caught, REQUEST_ERRORS, '코드를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    }
  });

  const submitEmail = (event: React.FormEvent) => {
    event.preventDefault();
    const target = email.trim();
    if (!EMAIL_PATTERN.test(target)) {
      setError('이메일 형식을 확인해 주세요.');
      return;
    }
    void requestCode(target);
  };

  const submitCode = (event: React.FormEvent) => {
    event.preventDefault();
    if (!sentTo) return;
    if (!/^\d{6}$/.test(code)) {
      setError('메일로 받은 숫자 6자리를 입력해 주세요.');
      return;
    }
    void run(async () => {
      try {
        const confirmed = await api.auth.confirmEmailVerification({ email: sentTo, code });
        setVerificationToken(confirmed.verificationToken);
        setNotice(null);
      } catch (caught) {
        setError(describe(caught, CONFIRM_ERRORS, '코드를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
      }
    });
  };

  /** 다른 이메일로 바꾼다. 받은 코드와 인증은 버린다 */
  const changeEmail = () => {
    setSentTo(null);
    setVerificationToken(null);
    setCode('');
    setCooldown(0);
    setNotice(null);
    setError(null);
    setPasswordError(false);
  };

  const submitSignup = (event: React.FormEvent) => {
    event.preventDefault();
    if (!sentTo || !verificationToken) return;
    const invalidPassword = (message: string) => {
      setError(message);
      setPasswordError(true);
    };
    setPasswordError(false);
    if (password.length < 8) {
      invalidPassword('비밀번호는 8자 이상으로 입력해 주세요.');
      return;
    }
    if (byteLength(password) > 72) {
      invalidPassword('비밀번호가 너무 깁니다. 한글은 24자, 영문은 72자까지 쓸 수 있습니다.');
      return;
    }
    if (password !== passwordAgain) {
      invalidPassword('비밀번호가 서로 다릅니다.');
      return;
    }
    if (!agreeTerms || !agreePrivacy) {
      setError('필수 약관에 동의해 주세요.');
      return;
    }
    void run(async () => {
      try {
        await signUp({ email: sentTo, password, verificationToken });
        navigate('/interview', { replace: true, state: { welcome: true, from } });
      } catch (caught) {
        if (caught instanceof SignedUpError) {
          setError('가입은 마쳤지만 로그인하지 못했습니다. 아래 「로그인」에서 가입한 이메일로 로그인해 주세요.');
          return;
        }
        if (caught instanceof ApiRequestError && caught.code === 'EMAIL_NOT_VERIFIED') {
          // 토큰이 30분을 넘겼거나 다른 이메일 것이다. 인증부터 다시 한다
          changeEmail();
          setError('이메일 인증이 만료됐습니다. 인증 코드를 다시 받아 주세요.');
          return;
        }
        setPasswordError(caught instanceof ApiRequestError && caught.code === 'VALIDATION_ERROR');
        setError(describe(caught, SIGNUP_ERRORS, '가입하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
      }
    });
  };

  const step = verificationToken ? 3 : sentTo ? 2 : 1;
  const errorBox = error &&
  <p role="alert" className="mt-3 text-[13px] text-deny">
      {error}
    </p>;


  return (
    <AuthLayout title="이메일로 가입">
      <h1 className="text-[26px] font-bold tracking-tight text-ink">
        이메일로 가입
      </h1>
      <p className="mt-2 text-[14px] leading-7 text-muted">
        메일로 받은 인증 코드를 확인한 뒤 비밀번호를 정합니다.
      </p>

      <ol className="mt-6 flex gap-2 text-[12px]" aria-label="가입 단계">
        {['이메일 인증', '코드 확인', '비밀번호'].map((label, index) =>
        <li
          key={label}
          aria-current={step === index + 1 ? 'step' : undefined}
          className={`flex-1 rounded-full px-2 py-1 text-center ${
          step === index + 1 ?
          'bg-accent font-bold text-white' :
          step > index + 1 ?
          'bg-canvas text-ink2' :
          'bg-canvas text-muted'}`
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
            aria-invalid={step === 1 && Boolean(error)}
            className={AUTH_INPUT} />

          {verificationToken &&
          <span className="mt-1.5 flex shrink-0 items-center gap-1 text-[13px] font-bold text-ok">
              <CheckIcon className="h-4 w-4" aria-hidden="true" />
              인증됨
            </span>
          }
        </div>
        {sentTo === null ?
        <>
            {step === 1 && errorBox}
            <button type="submit" disabled={busy} className={`mt-4 ${AUTH_PRIMARY}`}>
              {busy ? '보내는 중…' : '인증 코드 받기'}
            </button>
          </> :

        <button
          type="button"
          onClick={changeEmail}
          disabled={busy}
          className="mt-2 text-[12px] text-muted underline underline-offset-4 hover:text-ink">

            다른 이메일로 바꾸기
          </button>
        }
      </form>

      {notice &&
      <p role="status" className="mt-4 rounded-xl bg-canvas px-3.5 py-2.5 text-[13px] leading-6 text-ink2">
          {notice}
        </p>
      }

      {step === 2 &&
      <form onSubmit={submitCode} noValidate className="mt-5">
          <label htmlFor="signup-code" className={AUTH_LABEL}>
            인증 코드
          </label>
          <input
          id="signup-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          placeholder="숫자 6자리"
          aria-invalid={Boolean(error)}
          className={`${AUTH_INPUT} tracking-[0.3em] tabular-nums`} />

          {mockVerificationCode &&
        <p className="mt-2 text-[12px] leading-6 text-muted">
              목업 인증 코드는 {mockVerificationCode} 입니다.
            </p>
        }
          {errorBox}
          <button type="submit" disabled={busy} className={`mt-4 ${AUTH_PRIMARY}`}>
            {busy ? '확인 중…' : '코드 확인'}
          </button>
          <button
          type="button"
          disabled={busy || cooldown > 0}
          onClick={() => sentTo && void requestCode(sentTo)}
          className={`mt-2 ${AUTH_SECONDARY}`}>

            {cooldown > 0 ? `코드 다시 받기 (${cooldown}초)` : '코드 다시 받기'}
          </button>
          <p className="mt-2 text-[12px] leading-6 text-muted">
            메일이 오지 않으면 스팸함을 확인해 주세요. 하루에 5번까지 받을 수 있습니다.
          </p>
        </form>
      }

      {step === 3 &&
      <form onSubmit={submitSignup} noValidate className="mt-5">
          <div className="space-y-3">
            <div>
              <label htmlFor="signup-password" className={AUTH_LABEL}>
                비밀번호
              </label>
              <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="8자 이상"
              aria-invalid={passwordError}
              className={AUTH_INPUT} />

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
              onChange={(event) => setPasswordAgain(event.target.value)}
              aria-invalid={passwordError}
              className={AUTH_INPUT} />

            </div>
          </div>

          <fieldset className="mt-5 space-y-2 rounded-xl border border-line px-3.5 py-3 text-[13px]">
            <legend className="sr-only">약관 동의</legend>
            <label className="flex items-center gap-2 font-bold text-ink">
              <input
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
              <label className="flex flex-1 items-center gap-2">
                <input type="checkbox" checked={agreeTerms} onChange={(event) => setAgreeTerms(event.target.checked)} />
                [필수] 이용약관 동의
              </label>
              <button type="button" onClick={() => setDoc('terms')} className={DOC_LINK}>
                보기
              </button>
            </div>
            <div className="flex items-center gap-2 text-ink2">
              <label className="flex flex-1 items-center gap-2">
                <input
                  type="checkbox"
                  checked={agreePrivacy}
                  onChange={(event) => setAgreePrivacy(event.target.checked)} />

                [필수] 개인정보 수집·이용 동의
              </label>
              <button type="button" onClick={() => setDoc('privacy')} className={DOC_LINK}>
                보기
              </button>
            </div>
          </fieldset>

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

          {errorBox}
          <button type="submit" disabled={busy} className={`mt-5 ${AUTH_PRIMARY}`}>
            {busy ? '가입하는 중…' : '가입하기'}
          </button>
        </form>
      }

      <p className="mt-6 text-center text-[13px] text-muted">
        이미 계정이 있나요?{' '}
        <Link
          to="/login"
          state={from ? { from } : undefined}
          className="font-bold text-ink underline underline-offset-4 decoration-accent-line hover:decoration-ink">

          로그인
        </Link>
      </p>
    </AuthLayout>);

}
