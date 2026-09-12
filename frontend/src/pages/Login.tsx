import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LockIcon, MessageCircleIcon } from 'lucide-react';
import { useSession } from '../contexts/SessionContext';

interface LocationState {
  from?: string;
}

const PRINCIPLES = [
'판정마다 조문의 시행 버전을 붙입니다',
'근거를 못 붙이면 가능·불가로 저장하지 않습니다',
'카드내역 원본은 서버로 올라가지 않습니다'];


export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as LocationState | null)?.from ?? '/upload';

  const complete = (nextEmail: string) => {
    signIn(nextEmail);
    navigate(from, { replace: true });
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.includes('@')) {
      setError('이메일 형식을 확인해 주세요.');
      return;
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상 입력해 주세요.');
      return;
    }
    setError(null);
    complete(email);
  };

  return (
    <div className="flex min-h-full w-full bg-surface">
      {/* 좌측 브랜드 패널 */}
      <aside className="hidden w-[46%] flex-col justify-between bg-ink px-12 py-12 lg:flex">
        <Link to="/" className="flex items-center gap-2" aria-label="경비판정 홈">
          <span aria-hidden="true" className="flex gap-[3px]">
            <span className="block h-5 w-[5px] rounded-sm bg-white" />
            <span className="block h-5 w-[5px] rounded-sm bg-white" />
            <span className="block h-5 w-[5px] rounded-sm bg-accent" />
          </span>
          <span className="text-[17px] font-bold tracking-tight text-white">
            경비판정
          </span>
        </Link>

        <div>
          <h2 className="max-w-md text-[30px] font-bold leading-[1.35] tracking-tight text-white">
            결과만 주는 대신,
            <br />
            근거까지 드립니다
          </h2>
          <ul className="mt-8 space-y-3">
            {PRINCIPLES.map((principle) =>
            <li
              key={principle}
              className="flex gap-3 text-[14px] leading-7 text-white/70">
              
                <span
                aria-hidden="true"
                className="mt-3 h-1 w-1 shrink-0 rounded-full bg-accent" />
              
                {principle}
              </li>
            )}
          </ul>
        </div>

        <p className="max-w-md text-[12px] leading-6 text-white/40">
          이 서비스는 확인할 항목과 근거까지만 제시합니다. 세액을 확정하거나 세무
          신고를 대리하지 않습니다.
        </p>
      </aside>

      {/* 로그인 폼 */}
      <div className="flex flex-1 items-center justify-center px-6 py-14">
        <div className="w-full max-w-[380px]">
          <Link
            to="/"
            className="mb-10 flex items-center gap-2 lg:hidden"
            aria-label="경비판정 홈">
            
            <span aria-hidden="true" className="flex gap-[3px]">
              <span className="block h-5 w-[5px] rounded-sm bg-ink" />
              <span className="block h-5 w-[5px] rounded-sm bg-ink" />
              <span className="block h-5 w-[5px] rounded-sm bg-accent" />
            </span>
            <span className="text-[17px] font-bold tracking-tight text-ink">
              경비판정
            </span>
          </Link>

          <h1 className="text-[26px] font-bold tracking-tight text-ink">
            로그인
          </h1>
          <p className="mt-2 text-[14px] leading-7 text-muted">
            판정 이력과 저장된 답변은 계정에 묶여 관리됩니다.
          </p>

          <button
            type="button"
            onClick={() => complete('kakao-user@kakao.com')}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-4 py-3 text-[15px] font-semibold text-[#191600] transition-opacity duration-150 ease-snap hover:opacity-90">
            
            <MessageCircleIcon className="h-4 w-4" aria-hidden="true" />
            카카오로 계속하기
          </button>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[12px] text-muted">또는 이메일로 로그인</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={submit} noValidate>
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="email"
                  className="block text-[13px] font-medium text-ink2">
                  
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
                  className="mt-1.5 w-full rounded-xl border border-line px-3.5 py-2.5 text-[14px] text-ink placeholder:text-muted/70" />
                
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block text-[13px] font-medium text-ink2">
                  
                  비밀번호
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="6자 이상"
                  aria-invalid={Boolean(error)}
                  className="mt-1.5 w-full rounded-xl border border-line px-3.5 py-2.5 text-[14px] text-ink placeholder:text-muted/70" />
                
              </div>
            </div>

            {error &&
            <p role="alert" className="mt-3 text-[13px] text-deny">
                {error}
              </p>
            }

            <button
              type="submit"
              className="mt-5 w-full rounded-xl bg-accent px-4 py-3 text-[15px] font-semibold text-white transition-colors duration-150 ease-snap hover:bg-accent-hover">
              
              로그인
            </button>
          </form>

          <button
            type="button"
            onClick={() => complete('demo@expense-verdict.kr')}
            className="mt-3 w-full rounded-xl border border-line px-4 py-3 text-[14px] font-semibold text-ink transition-colors duration-150 ease-snap hover:bg-canvas">
            
            샘플 계정으로 둘러보기
          </button>

          <p className="mt-6 flex items-start gap-2 text-[12px] leading-6 text-muted">
            <LockIcon className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            로그인은 판정 이력 보관에만 사용합니다. 카드내역 원본은 계정에 저장되지
            않으며, 로그에 소득 금액과 이름을 남기지 않습니다.
          </p>
        </div>
      </div>
    </div>);

}