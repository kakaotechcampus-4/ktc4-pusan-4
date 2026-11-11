import React from 'react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { DISCLAIMER } from '../../copy';
import { Logo } from '../Logo';
import { MAIN_ID } from '../ui';
import { AppPreview } from './AppPreview';

/** 왼쪽 판의 한 단 */
const COLUMN = 'mx-auto w-full max-w-[400px]';

/**
 * 로그인, 가입, 비밀번호 재설정, 카카오 콜백 화면의 틀. 왼쪽은 로고와 폼, 오른쪽(lg 이상)은 파란 판 위의 작은 앱 미리보기다.
 * 폼은 한 단(400px)으로 왼쪽 판 가운데에 선다. 로고와 아래 고지는 판의 왼쪽 여백에 붙는다(11/11 치오)
 */
export function SignInLayout({ title, children }: {title: string;children: React.ReactNode;}) {
  useDocumentTitle(title);
  return (
    <div className="grid min-h-full w-full bg-canvas lg:grid-cols-[minmax(28rem,1fr)_minmax(0,1.15fr)]">
      <main id={MAIN_ID} tabIndex={-1} className="flex min-h-full flex-col px-6 py-8 outline-none sm:px-12 lg:px-16 lg:py-11">
        {/* 로고 링크는 그림 폭에 맞춘다. 단 폭으로 늘이면 빈 곳을 눌러도 홈으로 간다 */}
        <div>
          <span className="inline-flex">
            <Logo />
          </span>
        </div>
        <div className={`${COLUMN} my-auto py-12`}>{children}</div>
        <p className="max-w-[400px] text-caption text-muted">{DISCLAIMER}</p>
      </main>

      {/* 첫 화면의 파란 판(surface2)과 같은 색이다. 큰 원 둘은 앱 뒤의 그림이다 */}
      <div aria-hidden="true" className="relative hidden items-center justify-center overflow-hidden bg-surface2 px-12 py-16 lg:flex">
        <span className="absolute -top-[10%] left-[8%] h-[900px] w-[900px] rounded-full border border-white/20" />
        <span className="absolute left-[22%] top-[12%] h-[640px] w-[640px] rounded-full border border-white/15" />
        <div className="relative flex w-full justify-center motion-safe:animate-enter">
          <AppPreview />
        </div>
      </div>
    </div>);

}
