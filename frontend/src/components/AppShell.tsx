import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckIcon, UserIcon } from 'lucide-react';
import { DisclaimerBar } from './DisclaimerBar';

import { useSession } from '../contexts/SessionContext';

/**
 * 진행 단계. 순서는 PM 확정 흐름을 따른다:
 * 업로드 → 분류 결과 미리보기 → 문진 → 판정 → 결과 (→ 되묻기 → 재판정)
 * 문진은 판정 전 필수지만 첫 화면에 두지 않는다 (이탈 방지).
 */
const STEPS = [
{ path: '/upload', label: '카드내역' },
{ path: '/preview', label: '분류 확인' },
{ path: '/interview', label: '사업자 문진' },
{ path: '/run', label: '판정' },
{ path: '/results', label: '결과' }];

/** 빵부스러기에 쓸 이름. [무리, 화면] */
const CRUMB: Record<string, [string, string]> = {
  '/upload': ['카드내역', '카드내역 올리기'],
  '/preview': ['카드내역', '가맹점 분류 확인'],
  '/uploads': ['자료', '업로드 이력'],
  '/transactions': ['자료', '거래 목록'],
  '/interview': ['판정', '사업자 문진'],
  '/confirm': ['판정', '판정 확인'],
  '/run': ['판정', '판정 진행'],
  '/results': ['판정', '판정 결과'],
  '/questions': ['판정', '되묻기'],
  '/summary': ['판정', '세무사 전달 요약'],
  '/account': ['내 정보', '내 정보']
};

/** 흐름의 단계가 아니라 언제든 들러보는 자료 화면 */
const REFS = [
{ path: '/transactions', label: '거래' },
{ path: '/uploads', label: '업로드 이력' }];

/** 관리자에게만 보인다 (M1) */
const ADMIN_REF = { path: '/admin', label: '관리자' };

/** 단계 표시에 포함되지 않지만 특정 단계에 속하는 화면 */
const STEP_ALIAS: Record<string, number> = {
  '/confirm': 2,
  '/questions': 4,
  '/summary': 4,
  '/judgments': 4
};


interface AppShellProps {
  children: React.ReactNode;
  /** 판정 진행 화면처럼 흐름 표시가 방해되는 경우 숨긴다 */
  showSteps?: boolean;
}

export function AppShell({ children, showSteps = true }: AppShellProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { email, isAdmin, signOut } = useSession();
  const refs = isAdmin ? [...REFS, ADMIN_REF] : REFS;
  const activeIndex = STEPS.findIndex((step) =>
  pathname.startsWith(step.path)
  );
  const alias = Object.entries(STEP_ALIAS).find(([prefix]) =>
  pathname.startsWith(prefix)
  );
  const currentIndex = alias ? alias[1] : activeIndex;
  const crumb = Object.entries(CRUMB).find(([prefix]) =>
  pathname.startsWith(prefix)
  )?.[1];

  return (
    <div className="flex min-h-full w-full flex-col bg-canvas">
      <header className="sticky top-0 z-30 bg-canvas/95 backdrop-blur">
        {/*
          한 줄을 넘기면 한글이 음절 단위로 꺾인다. 줄바꿈을 막고, 폭이 모자라면 덜 중요한 것부터 접는다:
          xl 미만 — 지금 단계가 아닌 단계 이름 · lg 미만 — 귀속 연도, 이메일(아이콘으로) · md 미만 — 단계 표시
        */}
        <div className="mx-auto flex h-[72px] max-w-page items-center justify-between gap-3 whitespace-nowrap px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="경비판정 홈">
            <span aria-hidden="true" className="flex gap-[3px]">
              <span className="block h-[18px] w-[4px] rounded-sm bg-ink" />
              <span className="block h-[18px] w-[4px] rounded-sm bg-ink" />
              <span className="block h-[18px] w-[4px] rounded-sm bg-highlight" />
            </span>
            <span className="text-h4 font-bold tracking-tight text-ink">
              경비판정
            </span>
            <span aria-hidden="true" className="h-3.5 w-px bg-accent-line" />
            <span className="text-body text-ink2">판정</span>
          </Link>

          {showSteps && currentIndex >= 0 &&
          <nav aria-label="진행 단계" className="hidden shrink-0 md:block">
              <ol className="flex items-center gap-1.5">
                {STEPS.map((step, index) => {
                const done = index < currentIndex;
                const active = index === currentIndex;
                return (
                  <li key={step.path}>
                      <span
                      aria-current={active ? 'step' : undefined}
                      title={active ? undefined : step.label}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-small ${
                      active ?
                      'bg-accent font-bold text-white' :
                      done ?
                      'text-ink2' :
                      'text-muted'}`
                      }>
                      
                        {done ?
                      <CheckIcon
                        className="h-3.5 w-3.5 text-ink2"
                        aria-hidden="true" /> :


                      <span className="tabular-nums text-caption text-muted">
                            {index + 1}
                          </span>
                      }
                        {step.label}
                      </span>
                    </li>);

              })}
              </ol>
            </nav>
          }

          <div className="flex min-w-0 items-center gap-3 text-small text-muted">
            <nav aria-label="자료" className="flex shrink-0 items-center gap-1.5">
              {refs.map((ref) => {
                const active = pathname.startsWith(ref.path);
                return (
                  <Link
                    key={ref.path}
                    to={ref.path}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-full px-3 py-1.5 font-bold transition-colors duration-150 ease-snap ${
                    active ? 'bg-accent text-white' : 'text-ink2 hover:bg-surface'}`
                    }>

                    {ref.label}
                  </Link>);

              })}
            </nav>
            <span className="hidden h-4 w-px bg-line lg:inline" />
            <span className="hidden tabular-nums lg:inline">
              귀속 2026년
            </span>
            <span className="hidden h-4 w-px bg-line sm:inline" />
            <Link
              to="/account"
              aria-current={pathname.startsWith('/account') ? 'page' : undefined}
              className={`hidden min-w-0 max-w-[160px] truncate rounded-full px-3 py-1.5 transition-colors duration-150 ease-snap lg:inline ${
              pathname.startsWith('/account') ?
              'bg-accent text-white' :
              'hover:bg-surface hover:text-ink'}`
              }>

              {email}
            </Link>
            {/* 이메일을 줄인 폭에서도 내 정보로 갈 수 있게 한다 */}
            <Link
              to="/account"
              aria-current={pathname.startsWith('/account') ? 'page' : undefined}
              aria-label={`내 정보 (${email ?? ''})`}
              title={email ?? undefined}
              className={`hidden shrink-0 rounded-full p-2 transition-colors duration-150 ease-snap sm:inline-flex lg:hidden ${
              pathname.startsWith('/account') ?
              'bg-accent text-white' :
              'hover:bg-surface hover:text-ink'}`
              }>

              <UserIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={() => {
                signOut();
                navigate('/');
              }}
              className="shrink-0 rounded-full border border-accent-line px-3 py-1.5 text-caption font-bold text-ink transition-colors duration-150 ease-snap hover:border-ink">
              
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <DisclaimerBar />

      {crumb &&
      <nav
        aria-label="현재 위치"
        className="mx-auto w-full max-w-page px-6 pt-8 text-caption text-muted">

          <ol className="flex items-center gap-2">
            <li>
              <Link to="/" className="transition-colors hover:text-ink">
                홈
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li>{crumb[0]}</li>
            <li aria-hidden="true">›</li>
            <li className="text-ink2">{crumb[1]}</li>
          </ol>
        </nav>
      }

      <main className="mx-auto w-full max-w-page flex-1 px-6 pb-12 pt-5">
        {children}
      </main>

      <footer className="mt-10 bg-surface">
        <div className="mx-auto flex max-w-page flex-col gap-1 px-6 py-8 text-caption text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            카드내역 원본은 서버에 저장하지 않습니다. 카드번호·계좌번호는 브라우저
            파싱 단계에서 폐기됩니다.
          </p>
          <p className="tabular-nums">잠정 집계 · 당해연도 수입 확정 후 확정</p>
        </div>
      </footer>
    </div>);

}