import { isMock } from '../api';

/**
 * 카카오 로그인 (#176). 프론트가 카카오 인가 페이지로 보내고, 카카오가 콜백 주소로 넘긴 code 를 서버에 보낸다.
 * 콜백 주소는 빌드에 넣지 않고 지금 오리진으로 만든다. 서버 설정(APP_AUTH_KAKAO_REDIRECT_URI)과 같아야 한다
 */
export const KAKAO_CALLBACK_PATH = '/auth/kakao/callback';

const REST_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY ?? '';
const STORAGE_KEY = 'kakao-login';

/** 실서버는 REST API 키가 빌드에 들어 있어야 버튼을 보인다. 목업은 카카오에 다녀오지 않는다 */
export const kakaoAvailable = isMock || REST_API_KEY !== '';

interface PendingLogin {
  /** 인가 요청과 콜백이 같은 브라우저에서 이어진 것인지 맞춰 본다(CSRF) */
  state: string;
  /** 로그인 뒤 돌아갈 곳. router state 는 카카오에 다녀오면 사라진다 */
  from: string;
}

/**
 * 카카오로 보낼 주소를 만들고 state 와 돌아갈 곳을 sessionStorage 에 둔다.
 * 목업이면 콜백 화면으로 바로 간다 — external 이 false 면 라우터로 이동한다
 */
export function beginKakaoLogin(from: string): {url: string;external: boolean;} {
  const state = crypto.randomUUID();
  const pending: PendingLogin = { state, from };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  if (isMock) {
    const params = new URLSearchParams({ code: 'mock-kakao-code', state });
    return { url: `${KAKAO_CALLBACK_PATH}?${params.toString()}`, external: false };
  }
  const params = new URLSearchParams({
    client_id: REST_API_KEY,
    redirect_uri: `${window.location.origin}${KAKAO_CALLBACK_PATH}`,
    response_type: 'code',
    state
  });
  return { url: `https://kauth.kakao.com/oauth/authorize?${params.toString()}`, external: true };
}

/** 저장해 둔 로그인 요청을 꺼내고 지운다. 한 번만 쓴다 */
export function takeKakaoLogin(): PendingLogin | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingLogin>;
    return typeof parsed.state === 'string' && typeof parsed.from === 'string' ?
    { state: parsed.state, from: parsed.from } :
    null;
  } catch {
    return null;
  }
}
