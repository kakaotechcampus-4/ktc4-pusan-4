import React, { useEffect } from 'react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckIcon } from 'lucide-react';
import { DisclaimerBar } from './DisclaimerBar';
import { Button, MAIN_ID, SkipLink } from './ui';
import { BugReportButton } from './BugReport';
import { Logo } from './Logo';
import { STEPS, STEP_ALIAS, doneSteps, under } from './steps';
import { DISCLAIMER } from '../copy';

import { useSession } from '../contexts/SessionContext';
import { api, useApi } from '../api';
import type { Progress } from '../types/domain';
import { accountLabel } from '../utils/account';


/**
 * 빵부스러기에 쓸 이름. [무리, 화면]. 화면 이름은 탭 제목도 되고, 화면의 머리글·제목과 같다 (C84).
 * 무리와 화면 이름이 같으면 한 번만 적는다 (「내 정보 › 내 정보」, C102)
 */
const CRUMB: Record<string, [string, string]> = {
  '/upload': ['카드내역', '카드내역 올리기'],
  '/preview': ['카드내역', '분류 확인'],
  '/uploads': ['자료', '업로드 이력'],
  '/transactions': ['자료', '거래'],
  // 판정 흐름이 아니라 계정 설정이다. 고치는 길도 내 정보에 있다
  '/interview': ['내 정보', '사업자 문진'],
  '/confirm': ['판정', '판정 전 확인'],
  '/run': ['판정', '판정'],
  '/results': ['판정', '결과'],
  '/questions': ['판정', '질문'],
  '/summary': ['판정', '요약'],
  '/account': ['내 정보', '내 정보'],
  '/admin': ['관리자', '관리자']
};

/**
 * 화면마다 AppShell 을 새로 그린다. 진행 상황을 다시 읽는 동안 앞 화면이 읽은 것을 써서
 * 단계 표시의 ✓ 가 화면을 옮길 때마다 깜빡이지 않게 한다
 */
let lastProgress: Progress | null = null;

/** 흐름의 단계가 아니라 언제든 들러보는 자료 화면 */
interface NavRef {path: string;label: string;}

const REFS: NavRef[] = [
{ path: '/transactions', label: '거래' },
{ path: '/uploads', label: '업로드 이력' }];

/** 관리자에게만 보인다 (M1) */
const ADMIN_REF: NavRef = { path: '/admin', label: '관리자' };

/** 꼬리말 링크. 넷 다 같은 크기, 같은 굵기다. 버그 신고도 아이콘 없이 같은 모양이다 */
const FOOTER_LINK = 'transition-colors duration-150 ease-snap hover:text-ink hover:underline underline-offset-4';



interface AppShellProps {
  children: React.ReactNode;
  /** 판정 진행 화면처럼 흐름 표시가 방해되는 경우 숨긴다 */
  showSteps?: boolean;
  /**
   * 세무대리 오인 방지 고지(위의 DisclaimerBar 와 꼬리말의 같은 문장). 기본은 켠다.
   * 판정을 보여주지 않는 화면(내 정보)에서만 내린다 — 거기엔 오인할 판정 내용이 없다 (#242 리뷰)
   */
  disclaimer?: boolean;
  /**
   * 한 줄로 읽어 내려가는 화면(문진, 분류 확인, 판정 전 확인, 판정, 질문, 내 정보). 빵부스러기와 내용을
   * 가운데 한 단(max-w-3xl)에 둔다. 1440px 바탕의 왼쪽에 붙이면 오른쪽 절반이 빈다
   */
  narrow?: boolean;
}

export function AppShell({ children, showSteps = true, disclaimer = true, narrow = false }: AppShellProps) {
  const column = narrow ? 'mx-auto w-full max-w-3xl' : '';
  /**
   * 오른쪽 아래의 비서 버튼(오른쪽 20px, 56px)이 표 끝 칸과 상세 값을 덮지 않게 그만큼 비워 둔다.
   * 한 단 화면은 lg 부터 단 옆이 비어 덮을 것이 없으니 좌우를 같게 둔다. 빵부스러기도 같은 여백이라야 단과 줄이 맞는다
   */
  const gutter = narrow ? 'px-6 sm:pr-24 lg:pr-6' : 'px-6 sm:pr-24';
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { email, isAdmin, signOut, batchId } = useSession();
  const refs = isAdmin ? [...REFS, ADMIN_REF] : REFS;
  const activeIndex = STEPS.findIndex((step) => under(pathname, step.path));
  const alias = Object.entries(STEP_ALIAS).find(([prefix]) => under(pathname, prefix));
  const currentIndex = alias ? alias[1] : activeIndex;
  const crumb = Object.entries(CRUMB).find(([prefix]) => under(pathname, prefix))?.[1];
  useDocumentTitle(crumb?.[1]);

  const progressQ = useApi(
    () => showSteps && batchId ? api.progress.get(batchId) : Promise.resolve(null),
    [showSteps, batchId]
  );
  // 다른 업로드로 바꾼 직후에는 앞 업로드의 응답이 남아 있다. 못 읽었으면 끝났다고 치지 않는다
  const fresh = progressQ.data?.batch.id === batchId ? progressQ.data : null;
  useEffect(() => {
    if (fresh) lastProgress = fresh;
  }, [fresh]);
  const progress = progressQ.error ? null : fresh ?? (lastProgress?.batch.id === batchId ? lastProgress : null);
  const done = doneSteps(progress);

  return (
    <div className="flex min-h-full w-full flex-col bg-canvas">
      <SkipLink />
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 shadow-header backdrop-blur print:hidden">
        {/*
          한 줄을 넘기면 한글이 음절 단위로 꺾인다. 줄바꿈을 막고, 폭이 모자라면 덜 중요한 것부터 접는다:
          lg 미만 — 이메일(「내 정보」로) · md 미만 — 단계 표시
        */}
        <div className="mx-auto flex h-[72px] max-w-page items-center justify-between gap-3 whitespace-nowrap px-4 sm:px-6">
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
                const active = index === currentIndex;
                const finished = !active && done.has(step.path);
                return (
                  <li key={step.path}>
                      <Link
                      to={step.to ?? step.path}
                      aria-current={active ? 'step' : undefined}
                      title={active ? undefined : step.label}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-small transition-colors duration-150 ease-snap ${
                      active ? 'bg-accent font-bold text-white' : 'text-ink2 hover:bg-surface'}`
                      }>

                        {finished ?
                      <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> :

                      <span
                        className={`tabular-nums text-caption ${
                        /* 고른 단계는 바탕이 파래진다. 숫자를 muted 로 박아 두면 대비 1.05 라 칸이 빈 것처럼 보인다 */
                        active ? 'text-white' : 'text-ink2'}`
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

          {/* 390px 에서도 로고·자료·내 정보·로그아웃이 한 줄에 들어가도록 좁은 폭에서는 간격과 여백, 머리말 좌우 여백(16px)을 줄인다.
              그래도 넘치면(관리자 메뉴까지 있을 때) 자료 메뉴만 옆으로 밀리고 화면은 가로로 늘지 않는다 */}
          <div className="flex min-w-0 items-center gap-1.5 text-small text-ink2 sm:gap-3">
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
                    className={`shrink-0 whitespace-nowrap rounded-full px-2 py-1.5 font-bold transition-colors duration-150 ease-snap sm:px-3 ${
                    active ? 'bg-accent text-white' : 'text-ink2 hover:bg-surface'}`
                    }>

                    {ref.label}
                  </Link>);

              })}
            </nav>
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
            {/* 이메일을 줄인 폭에서도 내 정보로 갈 수 있게 한다. 아이콘만 두지 않고 화면 이름을 적는다 */}
            <Link
              to="/account"
              aria-current={pathname.startsWith('/account') ? 'page' : undefined}
              title={accountLabel(email)}
              className={`shrink-0 whitespace-nowrap rounded-full px-2 py-1.5 font-bold transition-colors duration-150 ease-snap sm:px-3 lg:hidden ${
              pathname.startsWith('/account') ?
              'bg-accent text-white' :
              'hover:bg-surface hover:text-ink'}`
              }>

              내 정보
            </Link>
            {/* 랜딩 머리말의 로그인 버튼과 같은 자리(맨 오른쪽)·같은 모양이다 */}
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0 max-sm:px-2.5 max-sm:text-small"
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
        className={`mx-auto w-full max-w-page pt-8 text-caption text-ink2 print:hidden ${narrow ? gutter : 'px-6'}`}>

          <ol className={`flex items-center gap-2 ${column}`}>
            <li>
              <Link to="/" className="transition-colors hover:text-ink">
                홈
              </Link>
            </li>
            {/*
              구분 기호를 aria-hidden 으로 숨기지 않는다. 접근성 보고서(2026-10-22)가
              「경로 영역의 기호(>) 정보 인식 불가」로 지적했다 — 단계 사이를 가르는 정보다
            */}
            {crumb[0] !== crumb[1] &&
          <>
                <li>›</li>
                <li>{crumb[0]}</li>
              </>
          }
            <li>›</li>
            <li className="text-ink">{crumb[1]}</li>
          </ol>
        </nav>
      }

      <main id={MAIN_ID} tabIndex={-1} className={`mx-auto w-full max-w-page flex-1 pb-12 pt-5 outline-none ${gutter}`}>
        {narrow ? <div className={column}>{children}</div> : children}
      </main>

      {/* 링크 순서와 색은 공개 화면의 꼬리말(MarketingFooter)과 같다 (C96) */}
      <footer className="mt-10 border-t border-line">
        {/* 좁은 화면에서는 오른쪽을 비울 폭이 없어 비서 버튼 높이만큼 아래를 비운다 */}
        <div className="mx-auto max-w-page px-6 pb-24 pt-8 text-caption text-ink2 sm:pb-8 sm:pr-24 print:p-0">
          <nav aria-label="도움말과 약관" className="text-muted print:hidden">
            <ul className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <li><Link to="/faq" className={FOOTER_LINK}>자주 묻는 질문</Link></li>
              <li><BugReportButton icon={false} className={FOOTER_LINK} /></li>
              <li><Link to="/terms" className={FOOTER_LINK}>이용약관</Link></li>
              <li><Link to="/privacy" className={FOOTER_LINK}>개인정보처리방침</Link></li>
            </ul>
          </nav>
          {/* 위의 고지 띠를 닫아도 고지는 여기 남는다. 인쇄(PDF)에도 들어간다 */}
          {disclaimer &&
          <p className="mt-4 max-w-3xl text-muted [word-break:keep-all] print:mt-6">{DISCLAIMER}</p>
          }
        </div>
      </footer>
    </div>);

}