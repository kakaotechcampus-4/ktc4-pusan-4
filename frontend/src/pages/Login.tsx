import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MessageCircleIcon } from 'lucide-react';
import { useSession } from '../contexts/SessionContext';
import { ApiRequestError, isMock, mockPassword } from '../api';
import { AUTH_INPUT, AUTH_LABEL, AUTH_PRIMARY, AUTH_SECONDARY, AuthLayout } from '../components/AuthLayout';
import { beginKakaoLogin, kakaoAvailable } from '../auth/kakao';

interface LocationState {
  from?: string;
}

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = (location.state as LocationState | null)?.from ?? '/';

  // 서버 문장은 그대로 띄우지 않는다. code 로 고른다 (api.md 1.1)
  const complete = async (nextEmail: string, nextPassword: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(nextEmail, nextPassword);
      navigate(from, { replace: true });
    } catch (caught) {
      const code = caught instanceof ApiRequestError ? caught.code : '';
      const status = caught instanceof ApiRequestError ? caught.status : -1;
      setError(
        code === 'INVALID_CREDENTIALS' ?
        '이메일 또는 비밀번호를 확인해 주세요.' :
        status === 0 ?
        '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' :
        '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.'
      );
      setBusy(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.includes('@')) {
      setError('이메일 형식을 확인해 주세요.');
      return;
    }
    // 길이 규칙은 가입할 때만 본다. 가입 전에 만든 계정의 비밀번호를 여기서 막지 않는다
    if (password === '') {
      setError('비밀번호를 입력해 주세요.');
      return;
    }
    void complete(email, password);
  };

  const startKakao = () => {
    const { url, external } = beginKakaoLogin(from);
    if (external) {
      window.location.assign(url);
      return;
    }
    navigate(url);
  };

  return (
    <AuthLayout title="로그인">
      <h1 className="text-[26px] font-bold tracking-tight text-ink">
        로그인
      </h1>
      <p className="mt-2 text-[14px] leading-7 text-muted">
        판정 이력과 저장된 답변은 계정에 묶여 관리됩니다.
      </p>

      {kakaoAvailable &&
      <>
          <button
          type="button"
          disabled={busy}
          onClick={startKakao}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-4 py-3 text-[15px] font-bold text-[#191600] transition-opacity duration-150 ease-snap hover:opacity-90">

            <MessageCircleIcon className="h-4 w-4" aria-hidden="true" />
            카카오로 계속하기
          </button>
          <p className="mt-2 text-[12px] leading-6 text-muted">
            카카오 계정은 이메일 계정과 따로입니다. 같은 이메일을 써도 합쳐지지 않습니다.
          </p>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[12px] text-muted">또는 이메일로 로그인</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      }

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
              aria-invalid={Boolean(error)}
              className={AUTH_INPUT} />

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
              aria-invalid={Boolean(error)}
              className={AUTH_INPUT} />

          </div>
        </div>

        {error &&
        <p role="alert" className="mt-3 text-[13px] text-deny">
            {error}
          </p>
        }

        <button type="submit" disabled={busy} className={`mt-5 ${AUTH_PRIMARY}`}>
          {busy ? '로그인 중…' : '로그인'}
        </button>
      </form>

      <p className="mt-4 text-center text-[13px] text-muted">
        아직 계정이 없나요?{' '}
        <Link
          to="/signup"
          state={{ from }}
          className="font-bold text-ink underline underline-offset-4 decoration-accent-line hover:decoration-ink">

          이메일로 가입하기
        </Link>
      </p>

      {isMock &&
      <button
        type="button"
        disabled={busy}
        onClick={() => void complete('demo@expense-verdict.kr', mockPassword ?? '')}
        className={`mt-3 ${AUTH_SECONDARY}`}>

          샘플 계정으로 둘러보기
        </button>
      }

      {isMock &&
      <p className="mt-2 text-[12px] leading-6 text-muted">
          목업 비밀번호는 {mockPassword} 입니다. admin@ 으로 시작하는 이메일은 관리자로 들어갑니다.
        </p>
      }
    </AuthLayout>);

}
