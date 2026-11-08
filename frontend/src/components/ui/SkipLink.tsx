/** 본문 바로가기 링크와 그 도착점의 id. 머리띠 메뉴를 Tab 으로 다 지나지 않고 본문으로 간다 (WCAG 2.4.1) */
export const MAIN_ID = 'main';

/**
 * 화면 맨 앞에 둔다. 평소에는 안 보이고 Tab 으로 처음 닿으면 왼쪽 위에 뜬다.
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
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-small focus:font-bold focus:text-white">

      본문 바로가기
    </a>);

}
