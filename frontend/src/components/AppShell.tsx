import React from 'react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckIcon, UserIcon } from 'lucide-react';
import { DisclaimerBar } from './DisclaimerBar';
import { Button } from './ui';
import { BugReportButton } from './BugReport';
import { Logo } from './Logo';
import { STEPS, STEP_ALIAS, under } from './steps';

import { useSession } from '../contexts/SessionContext';
import { accountLabel } from '../utils/account';


/** 빵부스러기에 쓸 이름. [무리, 화면] */
const CRUMB: Record<string, [string, string]> = {
  '/upload': ['카드내역', '카드내역 올리기'],
  '/preview': ['카드내역', '가맹점 분류 확인'],
  '/uploads': ['자료', '업로드 이력'],
  '/transactions': ['자료', '거래 목록'],
  // 판정 흐름이 아니라 계정 설정이다. 고치는 길도 내 정보에 있다
  '/interview': ['내 정보', '사업자 문진'],
  '/confirm': ['판정', '판정 확인'],
  '/run': ['판정', '판정 진행'],
  '/results': ['판정', '판정 결과'],
  '/questions': ['판정', '되묻기'],
  '/summary': ['판정', '세무사 전달 요약'],
  '/account': ['내 정보', '내 정보'],
  '/admin': ['관리자', '규칙 후보']
};

/** 흐름의 단계가 아니라 언제든 들러보는 자료 화면 */
/** short 는 640px 보다 좁을 때 보이는 이름이다 */
interface NavRef {path: string;label: string;short?: string;}

const REFS: NavRef[] = [
{ path: '/transactions', label: '거래' },
{ path: '/uploads', label: '업로드 이력', short: '이력' }];

/** 관리자에게만 보인다 (M1) */
const ADMIN_REF: NavRef = { path: '/admin', label: '관리자' };



interface AppShellProps {
  children: React.ReactNode;
  /** 판정 진행 화면처럼 흐름 표시가 방해되는 경우 숨긴다 */
  showSteps?: boolean;
  /**
   * 세무대리 오인 방지 고지(DisclaimerBar). 기본은 켠다.
   * 판정을 보여주지 않는 화면(내 정보)에서만 내린다 — 거기엔 오인할 판정 내용이 없다 (#242 리뷰)
   */
  disclaimer?: boolean;
}

export function AppShell({ children, showSteps = true, disclaimer = true }: AppShellProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { email, isAdmin, signOut } = useSession();
  const refs = isAdmin ? [...REFS, ADMIN_REF] : REFS;
  const activeIndex = STEPS.findIndex((step) => under(pathname, step.path));
  const alias = Object.entries(STEP_ALIAS).find(([prefix]) => under(pathname, prefix));
  const currentIndex = alias ? alias[1] : activeIndex;
  const crumb = Object.entries(CRUMB).find(([prefix]) => under(pathname, prefix))?.[1];
  useDocumentTitle(crumb?.[1]);

  return (
    <div className="flex min-h-full w-full flex-col bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 shadow-header backdrop-blur print:hidden">
        {/*
          한 줄을 넘기면 한글이 음절 단위로 꺾인다. 줄바꿈을 막고, 폭이 모자라면 덜 중요한 것부터 접는다:
          xl 미만 — 지금 단계가 아닌 단계 이름 · lg 미만 — 귀속 연도, 이메일(아이콘으로) · md 미만 — 단계 표시
        */}
        <div className="mx-auto flex h-[72px] max-w-page items-center justify-between gap-3 whitespace-nowrap px-6">
          <Logo
            suffix={
            <>
                <span aria-hidden="true" className="hidden h-3.5 w-px bg-accent-line sm:block" />
                <span className="hidden text-body text-ink2 sm:block">판정</span>
              </>
            } />

          {/* 자료 화면(거래·업로드 이력·내 정보)에서도 보여 결과로 돌아올 수 있게 한다 */}
          {showSteps &&
          <nav aria-label="진행 단계" className="hidden shrink-0 md:block">
              <ol className="flex items-center gap-1.5">
                {STEPS.map((step, index) => {
                const done = index < currentIndex;
                const active = index === currentIndex;
                return (
                  <li key={step.path}>
                      <Link
                      to={step.to ?? step.path}
                      aria-current={active ? 'step' : undefined}
                      title={active ? undefined : step.label}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-small transition-colors duration-150 ease-snap ${
                      active ?
                      'bg-accent font-bold text-white' :
                      done ?
                      'text-ink2 hover:bg-surface' :
                      'text-muted hover:bg-surface hover:text-ink2'}`
                      }>
                      
                        {done ?
                      <CheckIcon
                        className="h-3.5 w-3.5 text-ink2"
                        aria-hidden="true" /> :


                      <span
                        className={`tabular-nums text-caption ${
                        /* 고른 단계는 바탕이 파래진다. 숫자를 muted 로 박아 두면 대비 1.05 라 칸이 빈 것처럼 보인다 */
                        active ? 'text-white' : 'text-muted'}`
                        }>

                            {index + 1}
                          </span>
                      }
                        {step.label}
                      </Link>
                    </li>);

              })}
              </ol>
            </nav>
          }

          {/* 360px 에서도 로고·자료·내 정보·로그아웃이 한 줄에 들어가도록 좁은 폭에서는 간격과 이름을 줄인다.
              그래도 넘치면(관리자 메뉴까지 있을 때) 자료 메뉴만 옆으로 밀리고 화면은 가로로 늘지 않는다 */}
          <div className="flex min-w-0 items-center gap-2 text-small text-muted sm:gap-3">
            <nav
              aria-label="자료"
              className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] sm:shrink-0 sm:gap-1.5 sm:overflow-visible">
              {refs.map((ref) => {
                const active = under(pathname, ref.path);
                return (
                  <Link
                    key={ref.path}
                    to={ref.path}
                    aria-current={active ? 'page' : undefined}
                    aria-label={ref.short ? ref.label : undefined}
                    className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 font-bold transition-colors duration-150 ease-snap sm:px-3 ${
                    active ? 'bg-accent text-white' : 'text-ink2 hover:bg-surface'}`
                    }>

                    {ref.short ?
                    <>
                        <span className="sm:hidden">{ref.short}</span>
                        <span className="hidden sm:inline">{ref.label}</span>
                      </> :
                    ref.label}
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

              {accountLabel(email)}
            </Link>
            {/* 이메일을 줄인 폭에서도 내 정보로 갈 수 있게 한다. 640px 보다 좁아도 숨기지 않는다 */}
            <Link
              to="/account"
              aria-current={pathname.startsWith('/account') ? 'page' : undefined}
              aria-label={`내 정보 (${accountLabel(email)})`}
              title={accountLabel(email)}
              className={`inline-flex shrink-0 rounded-full p-2 transition-colors duration-150 ease-snap lg:hidden ${
              pathname.startsWith('/account') ?
              'bg-accent text-white' :
              'hover:bg-surface hover:text-ink'}`
              }>

              <UserIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
            {/* 랜딩 머리말의 로그인 버튼과 같은 자리(맨 오른쪽)·같은 모양이다 */}
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0 max-sm:px-3"
              onClick={() => {
                signOut();
                navigate('/');
              }}>
              
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      {disclaimer && <DisclaimerBar />}

      {crumb &&
      <nav
        aria-label="현재 위치"
        className="mx-auto w-full max-w-page px-6 pt-8 text-caption text-muted print:hidden">

          <ol className="flex items-center gap-2">
            <li>
              <Link to="/" className="transition-colors hover:text-ink">
                홈
              </Link>
            </li>
            {/*
              구분 기호를 aria-hidden 으로 숨기지 않는다. 접근성 보고서(2026-10-22)가
              「경로 영역의 기호(>) 정보 인식 불가」로 지적했다 — 단계 사이를 가르는 정보다
            */}
            <li>›</li>
            <li>{crumb[0]}</li>
            <li>›</li>
            <li className="text-ink2">{crumb[1]}</li>
          </ol>
        </nav>
      }

      <main className="mx-auto w-full max-w-page flex-1 px-6 pb-12 pt-5">
        {children}
      </main>

      <footer className="mt-10 bg-surface print:hidden">
        <div className="mx-auto flex max-w-page flex-col gap-1 px-6 py-8 text-caption text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            카드내역 원본은 서버에 저장하지 않습니다. 카드번호·계좌번호는 브라우저
            파싱 단계에서 폐기됩니다.
          </p>
          <p className="tabular-nums">잠정 집계 · 당해연도 수입 확정 후 확정</p>
        </div>
        <nav aria-label="도움말과 약관" className="mx-auto max-w-page px-6 pb-8 text-caption text-muted">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <li><Link to="/faq" className="hover:text-ink hover:underline underline-offset-4">자주 묻는 질문</Link></li>
            <li><Link to="/terms" className="hover:text-ink hover:underline underline-offset-4">이용약관</Link></li>
            <li><Link to="/privacy" className="font-bold hover:text-ink hover:underline underline-offset-4">개인정보처리방침</Link></li>
            <li><BugReportButton /></li>
          </ul>
        </nav>
      </footer>
    </div>);

}