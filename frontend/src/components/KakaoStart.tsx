import { useNavigate } from 'react-router-dom';
import { MessageCircleIcon } from 'lucide-react';
import { beginKakaoLogin, kakaoAvailable } from '../auth/kakao';

interface KakaoStartProps {
  /** 카카오에서 돌아와 로그인한 뒤 갈 곳 */
  from: string;
  label: string;
  /** 버튼 아래 가름줄 글자. 그 아래 이메일 폼이 이어진다 */
  divider: string;
  disabled?: boolean;
}

/**
 * 카카오 버튼과 이메일 폼 사이 가름줄. 로그인과 가입이 같이 쓴다.
 * 카카오는 처음 보는 회원번호면 계정을 새로 만들어 가입과 로그인이 같은 길이다 (#176)
 */
export function KakaoStart({ from, label, divider, disabled }: KakaoStartProps) {
  const navigate = useNavigate();
  if (!kakaoAvailable) return null;

  const start = () => {
    const { url, external } = beginKakaoLogin(from);
    if (external) {
      window.location.assign(url);
      return;
    }
    navigate(url);
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={start}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-4 py-3 text-[15px] font-bold text-[#191600] transition-opacity duration-150 ease-snap hover:opacity-90">

        <MessageCircleIcon className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[12px] text-ink2">{divider}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
    </>);

}
