import React, { useEffect } from 'react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Link, useLocation } from 'react-router-dom';
import { CheckIcon } from 'lucide-react';
import { DisclaimerBar } from './DisclaimerBar';
import { Button, MAIN_ID } from './ui';
import { BugReportButton } from './BugReport';
import { Logo } from './Logo';
import { AccountMenu } from './AccountMenu';
import { STEPS, STEP_ALIAS, doneSteps, under } from './steps';
import { DISCLAIMER } from '../copy';

import { useSession } from '../contexts/SessionContext';
import { api, useApi } from '../api';
import type { Progress } from '../types/domain';


/** 탭 제목. 화면의 머리글·제목과 같다 (C84) */
const TITLE: Record<string, string> = {
  '/upload': '카드내역 올리기',
  '/preview': '분류 확인',
  '/uploads': '업로드 이력',
  '/transactions': '거래',
  '/yearly': '연간 결과',
  '/interview': '사업자 문진',
  '/confirm': '판정 전 확인',
  '/run': '판정',
  '/results': '결과',
  '/questions': '질문',
  '/summary': '요약',
  '/account': '내 정보',
  '/admin': '관리자'
};

/**
 * 화면마다 AppShell 을 새로 그린다. 진행 상황을 다시 읽는 동안 앞 화면이 읽은 것을 써서
 * 단계 표시의 ✓ 가 화면을 옮길 때마다 깜빡이지 않게 한다
 */
let lastProgress: Progress | null = null;

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
   * 한 줄로 읽어 내려가는 화면(문진, 분류 확인, 판정 전 확인, 판정, 질문, 내 정보). 내용을
   * 가운데 한 단(max-w-3xl)에 둔다. 1440px 바탕의 왼쪽에 붙이면 오른쪽 절반이 빈다
   */
  narrow?: boolean;
}

export function AppShell({ children, showSteps = true, disclaimer = true, narrow = false }: AppShellProps) {
  const column = narrow ? 'mx-auto w-full max-w-3xl' : '';
  /**
   * 오른쪽 아래의 비서 버튼(오른쪽 20px, 56px)이 표 끝 칸과 상세 값을 덮지 않게 그만큼 비워 둔다.
   * 한 단 화면은 lg 부터 단 옆이 비어 덮을 것이 없으니 좌우를 같게 둔다
   */
  const gutter = narrow ? 'px-6 sm:pr-24 lg:pr-6' : 'px-6 sm:pr-24';
  const { pathname } = useLocation();
  const { batchId } = useSession();
  const activeIndex = STEPS.findIndex((step) => under(pathname, step.path));
  const alias = Object.entries(STEP_ALIAS).find(([prefix]) => under(pathname, prefix));
  const currentIndex = alias ? alias[1] : activeIndex;
  useDocumentTitle(Object.entries(TITLE).find(([prefix]) => under(pathname, prefix))?.[1]);

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

  /**
   * 진행 중인 판정. 진행 화면을 떠나도 어느 화면에서든 돌아갈 길을 띠로 준다. 단계 표시는 좁은 화면에서 숨어서
   * 그것만으로는 길이 없다. 진행 화면과, 그리로 보내는 판정 전 확인에서는 띄우지 않는다. 못 읽으면 띄우지 않는다
   */
  const onRunFlow = under(pathname, '/run') || under(pathname, '/confirm');
  const activeRunQ = useApi(() => onRunFlow ? Promise.resolve(null) : api.runs.active(), [onRunFlow]);
  const activeRun = activeRunQ.error ? null : activeRunQ.data;

  return (
    <div className="flex min-h-full w-full flex-col bg-canvas">
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

          <AccountMenu />
        </div>
      </header>

      {activeRun &&
      <div role="status" className="border-b border-line bg-surface print:hidden">
          <div className="mx-auto flex max-w-page items-center gap-3 px-6 py-2">
            <p className="min-w-0 flex-1 text-small text-ink [word-break:keep-all]">판정하고 있습니다.</p>
            <Button to={`/run/${activeRun.id}`} size="sm" variant="secondary" className="shrink-0">
              진행 보기
            </Button>
          </div>
        </div>
      }

      {disclaimer && <DisclaimerBar />}

      <main id={MAIN_ID} tabIndex={-1} className={`mx-auto w-full max-w-page flex-1 pb-12 pt-10 outline-none ${gutter}`}>
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