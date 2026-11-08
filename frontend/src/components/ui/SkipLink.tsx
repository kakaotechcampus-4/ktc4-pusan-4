/** 본문 바로가기 링크와 그 도착점의 id. 머리띠 메뉴를 Tab 으로 다 지나지 않고 본문으로 간다 (WCAG 2.4.1) */
export const MAIN_ID = 'main';

/**
 * 화면 맨 앞에 둔다. 평소에는 안 보이고 Tab 으로 처음 닿으면 화면 맨 위에 한 줄 띠로 나타나 아래를 민다.
 * 떠 있게 두면 로고나 메뉴 위에 겹친다(로그인 화면에서 로고를 덮었다)
 * 주소의 #main 으로 가지 않고 직접 옮긴다. 해시가 바뀌면 라우터가 스크롤을 다시 잡는다
 */
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_ID}`}
      onClick={(event) => {
        const main = document.getElementById(MAIN_ID);
        if (!main) return;
        event.preventDefault();
        main.focus();
        main.scrollIntoView();
      }}
      className="sr-only focus:not-sr-only focus:block focus:w-full focus:bg-accent focus:py-2.5 focus:text-center focus:text-small focus:font-bold focus:text-white focus:outline-none">

      본문 바로가기
    </a>);

}
