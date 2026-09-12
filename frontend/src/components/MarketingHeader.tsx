import React from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';
import { Button, Container } from './ui';

const NAV = [
{ href: '#system', label: '판정 방식' },
{ href: '#flow', label: '이용 흐름' },
{ href: '#evidence', label: '근거 데이터' },
{ href: '#scope', label: '하지 않는 일' }];


export function MarketingHeader() {
  const { isAuthenticated } = useSession();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <Container className="flex h-16 items-center gap-8">
        <Link to="/" className="flex items-center gap-2" aria-label="경비판정 홈">
          <span aria-hidden="true" className="flex gap-[3px]">
            <span className="block h-5 w-[5px] rounded-sm bg-ink" />
            <span className="block h-5 w-[5px] rounded-sm bg-ink" />
            <span className="block h-5 w-[5px] rounded-sm bg-accent" />
          </span>
          <span className="text-h4 font-bold tracking-tight text-ink">
            경비판정
          </span>
        </Link>

        <nav aria-label="주요 메뉴" className="hidden md:block">
          <ul className="flex items-center gap-7">
            {NAV.map((item) =>
            <li key={item.href}>
                <a
                href={item.href}
                className="text-body font-medium text-ink2 transition-colors duration-150 hover:text-ink">
                
                  {item.label}
                </a>
              </li>
            )}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {isAuthenticated ?
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