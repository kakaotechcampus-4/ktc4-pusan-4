import { Link } from 'react-router-dom';
import dark from '../assets/brand/logo/preet-logo.svg';
import light from '../assets/brand/logo/preet-logo-white.svg';

/**
 * 서비스 로고. 확정된 브랜드 워드마크를 쓴다 (assets/brand/logo).
 *
 * 전에는 화면마다 막대 셋을 직접 그려서 크기가 달랐다 — 공개 헤더 20×5, 로그인 뒤
 * 헤더 18×4, 로그인 화면은 강조 막대 색까지 달랐다. 그릴 것이 없어졌으니 한 군데로 모인다.
 *
 * SVG 는 글자까지 도형으로 바꿔 두어서 폰트를 설치하지 않아도 그대로 보인다.
 * 비율은 원본(391×126)을 따르고 높이만 정한다 — 늘이거나 줄이지 않는다.
 *
 * tone 은 바탕색이다. light 는 어두운 판 위(로그인 화면 왼쪽)에 쓴다.
 */
export function Logo({
  tone = 'dark',
  suffix


}: {tone?: 'dark' | 'light'; suffix?: React.ReactNode;}) {
  return (
    <Link
      to="/"
      className="flex shrink-0 items-center gap-2.5 whitespace-nowrap"
      aria-label="PreeT 홈">

      <img
        src={tone === 'light' ? light : dark}
        alt="PreeT"
        width={87}
        height={28}
        className="block h-7 w-auto" />

      {/* 로그인 뒤 헤더가 로고 옆에 「판정」을 붙인다. 같은 링크 안에 둔다 */}
      {suffix}
    </Link>);

}
