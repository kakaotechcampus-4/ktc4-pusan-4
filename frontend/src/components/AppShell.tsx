import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckIcon } from 'lucide-react';
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
  const { email, signOut } = useSession();
  const activeIndex = STEPS.findIndex((step) =>
  pathname.startsWith(step.path)
  );
  const alias = Object.entries(STEP_ALIAS).find(([prefix]) =>
  pathname.startsWith(prefix)
  );
  const currentIndex = alias ? alias[1] : activeIndex;

  return (
    <div className="flex min-h-full w-full flex-col bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2" aria-label="경비판정 홈">
            <span aria-hidden="true" className="flex gap-[3px]">
              <span className="block h-[18px] w-[4px] rounded-sm bg-ink" />
              <span className="block h-[18px] w-[4px] rounded-sm bg-ink" />
              <span className="block h-[18px] w-[4px] rounded-sm bg-accent" />
            </span>
            <span className="text-[15px] font-bold tracking-tight text-ink">
              경비판정
            </span>
          </Link>

          {showSteps && currentIndex >= 0 &&
          <nav aria-label="진행 단계" className="hidden md:block">
              <ol className="flex items-center gap-1">
                {STEPS.map((step, index) => {
                const done = index < currentIndex;
                const active = index === currentIndex;
                return (
                  <li key={step.path} className="flex items-center gap-1">
                      {index > 0 &&
                    <span
                      aria-hidden="true"
                      className="h-px w-5 bg-line" />

                    }
                      <span
                      aria-current={active ? 'step' : undefined}
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] ${
                      active ?
                      'bg-accent-soft font-semibold text-accent' :
                      done ?
                      'text-ink2' :
                      'text-muted'}`
                      }>
                      
                        {done ?
                      <CheckIcon
                        className="h-3.5 w-3.5 text-ok"
                        aria-hidden="true" /> :


                      <span className="tabular-nums text-[11px] text-muted">
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

          <div className="flex items-center gap-3 text-[13px] text-muted">
            <span className="hidden tabular-nums sm:inline">
              귀속 2026년
            </span>
            <span className="hidden h-4 w-px bg-line sm:inline" />
            <span className="hidden max-w-[160px] truncate sm:inline">
              {email}
            </span>
            <button
              type="button"
              onClick={() => {
                signOut();
                navigate('/');
              }}
              className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-semibold text-ink transition-colors duration-150 ease-snap hover:bg-canvas">
              
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <DisclaimerBar />

      <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 py-8">
        {children}
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-1 px-6 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            카드내역 원본은 서버에 저장하지 않습니다. 카드번호·계좌번호는 브라우저
            파싱 단계에서 폐기됩니다.
          </p>
          <p className="tabular-nums">잠정 집계 · 당해연도 수입 확정 후 확정</p>
        </div>
      </footer>
    </div>);

}