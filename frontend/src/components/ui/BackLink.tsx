import { useNavigate } from 'react-router-dom';

/** 본문 <main> 의 id. 화면마다 본문 영역 하나를 같은 이름으로 둔다 */
export const MAIN_ID = 'main';

/**
 * 뒤로가기. 화면 맨 앞에 둔다. 평소에는 안 보이고 Tab 으로 처음 닿으면 화면 맨 위에 한 줄 띠로
 * 나타나 아래를 민다. 떠 있게 두면 로고나 메뉴 위에 겹친다(로그인 화면에서 로고를 덮었다).
 * 앞 화면이 없으면(주소로 바로 들어왔으면) 홈으로 간다
 */
export function BackLink() {
  const navigate = useNavigate();
  return (
    <a
      href="/"
      onClick={(event) => {
        event.preventDefault();
        // react-router 가 history.state.idx 에 이 탭 안에서 몇 번째 화면인지 적어 둔다
        const idx = (window.history.state as {idx?: number;} | null)?.idx ?? 0;
        if (idx > 0) navigate(-1);else
        navigate('/');
      }}
      className="sr-only focus:not-sr-only focus:block focus:w-full focus:bg-accent focus:py-2.5 focus:text-center focus:text-small focus:font-bold focus:text-white focus:outline-none">

      뒤로가기
    </a>);

}
