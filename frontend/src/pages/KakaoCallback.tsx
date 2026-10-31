import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2Icon } from 'lucide-react';
import { useSession } from '../contexts/SessionContext';
import { ApiRequestError } from '../api';
import { AUTH_PRIMARY, AUTH_SECONDARY, AuthLayout } from '../components/AuthLayout';
import { takeKakaoLogin } from '../auth/kakao';

const ERRORS: Record<string, string> = {
  INVALID_KAKAO_CODE: '카카오 로그인이 만료됐습니다. 처음부터 다시 시도해 주세요.',
  KAKAO_UNAVAILABLE: '카카오와 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  KAKAO_LOGIN_UNAVAILABLE: '지금은 카카오 로그인을 쓸 수 없습니다. 이메일로 로그인해 주세요.'
};

/**
 * 카카오가 인가 뒤 돌려보내는 곳 (#176). code 를 서버에 보내 로그인하고, 로그인 전에 보던 곳으로 간다.
 * code 는 한 번만 쓸 수 있어서 한 번만 보내고, 새로고침에 다시 쓰이지 않게 주소에서 지운다
 */
export function KakaoCallback() {
  const navigate = useNavigate();
  const { signInWithKakao } = useSession();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const denied = params.get('error');
    window.history.replaceState(null, '', window.location.pathname);
    const pending = takeKakaoLogin();

    if (denied) {
      setError(
        denied === 'access_denied' ?
        '카카오 로그인을 취소했습니다.' :
        '카카오에서 로그인하지 못했습니다. 다시 시도해 주세요.'
      );
      return;
    }
    // 이 브라우저에서 시작한 로그인이 아니다. 남이 만든 링크로 다른 계정에 로그인되지 않게 막는다
    if (!code || !pending || pending.state !== state) {
      setError('로그인 요청을 확인하지 못했습니다. 처음부터 다시 시도해 주세요.');
      return;
    }

    void signInWithKakao(code).
    then(() => navigate(pending.from, { replace: true })).
    catch((caught: unknown) => {
      const known = caught instanceof ApiRequestError ? ERRORS[caught.code] : undefined;
      const offline = caught instanceof ApiRequestError && caught.status === 0;
      setError(
        known ?? (
        offline ?
        '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' :
        '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      );
    });
  }, [navigate, signInWithKakao]);

  return (
    <AuthLayout>
      {error ?
      <>
          <h1 className="text-[26px] font-bold tracking-tight text-ink">
            카카오 로그인
          </h1>
          <p role="alert" className="mt-3 text-[14px] leading-7 text-deny">
            {error}
          </p>
          <button type="button" onClick={() => navigate('/login', { replace: true })} className={`mt-6 ${AUTH_PRIMARY}`}>
            로그인 화면으로
          </button>
          <button type="button" onClick={() => navigate('/', { replace: true })} className={`mt-2 ${AUTH_SECONDARY}`}>
            홈으로
          </button>
        </> :

      <p role="status" className="flex items-center gap-2 text-[15px] text-ink2">
          <Loader2Icon className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
          카카오 계정으로 로그인하고 있습니다…
        </p>
      }
    </AuthLayout>);

}
