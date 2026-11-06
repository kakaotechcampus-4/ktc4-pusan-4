import { Link, useLocation } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';
import { Button, Container, cn } from './ui';
import { Logo } from './Logo';
import { BugReportButton } from './BugReport';

/**
 * 랜딩·FAQ 같은 공개 화면의 머리. 랜딩 안 앵커 대신 별도 페이지로 간다.
 *
 * 로그인 상태에 따라 오른쪽이 통째로 갈린다. 로그인을 이어 가는 동안은
 * 비워 두어, 로그인 버튼이 잠깐 보였다 바뀌지 않게 한다.
 */
const NAV = [{ to: '/faq', label: 'FAQ' }];
/*
 * 로그인 뒤 머리띠(AppShell)의 「자료」 알약과 같은 모양·같은 색으로 맞춘다 (#242 리뷰).
 * 공개 화면은 글자 링크, 로그인 뒤는 알약이라 같은 서비스로 보이지 않았다.
 * 폭·여백(max-w-page px-6)과 높이(72px)는 원래 같았다 — 알약만 달랐다
 */
const NAV_LINK =
'shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 text-small font-bold transition-colors duration-150 ease-snap sm:px-3';
const NAV_ON = 'bg-accent text-white';
const NAV_OFF = 'text-ink2 hover:bg-surface';


export function MarketingHeader() {
  const { status, signOut } = useSession();
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 shadow-header backdrop-blur">
      <Container className="flex h-[72px] items-center gap-6 lg:gap-10">
        <Logo />

        {/* 좁은 폭에서는 접는다. 같은 두 링크를 푸터에 두었다 */}
        <nav aria-label="주요 메뉴" className="hidden sm:block">
          <ul className="flex items-center gap-1.5">
            {NAV.map((item) => {
              const active = pathname === item.to;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    className={cn(NAV_LINK, active ? NAV_ON : NAV_OFF)}>

                    {item.label}
                  </Link>
                </li>);

            })}
            {/* 페이지로 옮기지 않고 창으로 띄운다(#211). /bug-report 는 꼬리말 링크와 직접 들어올 때 쓴다 */}
            <li>
              <BugReportButton className={cn(NAV_LINK, NAV_OFF)} icon={false} />
            </li>
          </ul>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap">
          {status === 'restoring' ?
          null :
          status === 'signedIn' ?
          <>
              {/* 좁은 폭에서는 접는다. 바로 아래 히어로에 같은 자리로 가는 CTA 가 있다 */}
              <Button to="/upload" size="sm" className="hidden sm:inline-flex">
                내 판정으로
              </Button>
              <Button to="/account" variant="secondary" size="sm">
                내 정보
              </Button>
              <Button variant="secondary" size="sm" onClick={signOut}>
                로그아웃
              </Button>
            </> :

          <>
              <Button to="/login" variant="secondary" size="sm">
                로그인
              </Button>
              <Button to="/signup" variant="soft" size="sm">
                회원가입
              </Button>
            </>
          }
        </div>
      </Container>
    </header>);

}
