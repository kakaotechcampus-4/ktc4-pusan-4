import { Link } from 'react-router-dom';

/**
 * 서비스 로고. 막대 셋 + 글자.
 *
 * 화면마다 따로 그려서 크기가 달랐다 — 공개 헤더는 20×5, 로그인 뒤 헤더는 18×4,
 * 로그인 화면은 20×5 에 강조 막대 색까지 달랐다. 한 군데로 모은다.
 *
 * tone 은 바탕색이다. light 는 어두운 판 위(로그인 화면 왼쪽)에 쓴다.
 * 강조 막대는 양쪽 다 highlight 다 — 어두운 판에서 accent 를 쓰면 바탕과 같은 색이라
 * 막대가 하나 사라진 것처럼 보였다
 */
export function Logo({
  tone = 'dark',
  suffix


}: {tone?: 'dark' | 'light'; suffix?: React.ReactNode;}) {
  const bar = tone === 'light' ? 'bg-white' : 'bg-ink';
  const text = tone === 'light' ? 'text-white' : 'text-ink';
  return (
    <Link
      to="/"
      className="flex shrink-0 items-center gap-2.5 whitespace-nowrap"
      aria-label="PreeT 홈">

      <span aria-hidden="true" className="flex gap-[3px]">
        <span className={`block h-5 w-[5px] rounded-sm ${bar}`} />
        <span className={`block h-5 w-[5px] rounded-sm ${bar}`} />
        <span className="block h-5 w-[5px] rounded-sm bg-highlight" />
      </span>
      <span className={`text-h4 font-bold tracking-tight ${text}`}>PreeT</span>
      {/* 로그인 뒤 헤더가 로고 옆에 「판정」을 붙인다. 같은 링크 안에 둔다 */}
      {suffix}
    </Link>);

}
