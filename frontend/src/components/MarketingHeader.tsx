import { Link } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';
import { Button, Container } from './ui';

/**
 * 랜딩·FAQ 같은 공개 화면의 머리. 랜딩 안 앵커 대신 별도 페이지로 간다.
 *
 * 로그인 상태에 따라 오른쪽이 통째로 갈린다. 로그인을 이어 가는 동안은
 * 비워 두어, 로그인 버튼이 잠깐 보였다 바뀌지 않게 한다.
 */
const NAV = [
{ to: '/faq', label: 'FAQ' },
{ to: '/bug-report', label: '버그 신고' }];


export function MarketingHeader() {
  const { status, signOut } = useSession();

  return (
    <header className="sticky top-0 z-30 bg-canvas/95 backdrop-blur">
      <Container className="flex h-[72px] items-center gap-6 lg:gap-10">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 whitespace-nowrap" aria-label="PreeT 홈">
          <span aria-hidden="true" className="flex gap-[3px]">
            <span className="block h-5 w-[5px] rounded-sm bg-ink" />
            <span className="block h-5 w-[5px] rounded-sm bg-ink" />
            <span className="block h-5 w-[5px] rounded-sm bg-highlight" />
          </span>
          <span className="text-h4 font-bold tracking-tight text-ink">
            PreeT
          </span>
        </Link>

        {/* 좁은 폭에서는 접는다. 같은 두 링크를 푸터에 두었다 */}
        <nav aria-label="주요 메뉴" className="hidden sm:block">
          <ul className="flex items-center gap-8">
            {NAV.map((item) =>
            <li key={item.to}>
                <Link
                to={item.to}
                className="whitespace-nowrap text-body font-normal text-ink2 transition-colors duration-150 hover:text-ink">

                  {item.label}
                </Link>
              </li>
            )}
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
                마이페이지
              </Button>
              <Button variant="secondary" size="sm" onClick={signOut}>
                로그아웃
              </Button>
            </> :

          <>
              <Button to="/login" variant="secondary" size="sm">
                로그인
              </Button>
              <Button to="/login" variant="soft" size="sm">
                회원가입
              </Button>
            </>
          }
        </div>
      </Container>
    </header>);

}
