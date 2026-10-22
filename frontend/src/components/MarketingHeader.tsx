import { Link } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';
import { Button, Container } from './ui';

const NAV = [
{ href: '#system', label: '판정 방식' },
{ href: '#flow', label: '이용 흐름' },
{ href: '#evidence', label: '근거 데이터' },
{ href: '#scope', label: '하지 않는 일' }];


export function MarketingHeader() {
  const { status } = useSession();

  return (
    <header className="sticky top-0 z-30 bg-canvas/95 backdrop-blur">
      <Container className="flex h-[72px] items-center gap-6 lg:gap-10">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 whitespace-nowrap" aria-label="경비판정 홈">
          <span aria-hidden="true" className="flex gap-[3px]">
            <span className="block h-5 w-[5px] rounded-sm bg-ink" />
            <span className="block h-5 w-[5px] rounded-sm bg-ink" />
            <span className="block h-5 w-[5px] rounded-sm bg-highlight" />
          </span>
          <span className="text-h4 font-bold tracking-tight text-ink">
            경비판정
          </span>
          <span aria-hidden="true" className="hidden h-3.5 w-px bg-accent-line sm:block" />
          <span className="hidden text-body text-ink2 sm:block">판정 안내</span>
        </Link>

        <nav aria-label="주요 메뉴" className="hidden md:block">
          <ul className="flex items-center gap-8">
            {NAV.map((item) =>
            <li key={item.href}>
                <a
                href={item.href}
                className="text-body font-normal text-ink2 transition-colors duration-150 hover:text-ink">
                
                  {item.label}
                </a>
              </li>
            )}
          </ul>
        </nav>

        {/* 로그인을 이어 가는 동안은 비워 둔다. 로그인 버튼이 잠깐 보였다 바뀌지 않게 */}
        <div className="ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap">
          {status === 'restoring' ?
          null :
          status === 'signedIn' ?
          <Button to="/upload" size="sm">
              내 판정으로
            </Button> :

          <>
              <Button to="/login" variant="secondary" size="sm">
                로그인
              </Button>
              <Button to="/login" variant="soft" size="sm">
                무료로 시작하기
              </Button>
            </>
          }
        </div>
      </Container>
    </header>);

}