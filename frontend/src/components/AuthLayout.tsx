import React from 'react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { DISCLAIMER } from '../copy';
import { Logo } from './Logo';
import { MAIN_ID, SkipLink } from './ui';

const PRINCIPLES = [
'판정마다 근거 조문과 시행일을 붙입니다',
'근거를 못 붙이면 가능이나 불가로 저장하지 않습니다',
'카드내역 원본은 서버로 올라가지 않습니다'];


/** 로그인·가입·카카오 콜백이 같이 쓰는 틀. 왼쪽은 브랜드 패널(lg 이상), 오른쪽은 폼 */
export function AuthLayout({ title, children }: {title: string;children: React.ReactNode;}) {
  useDocumentTitle(title);
  return (
    <div className="flex min-h-full w-full flex-col bg-canvas">
      <SkipLink />
      <div className="flex w-full flex-1">
        {/* 좌측 브랜드 패널 */}
        <aside className="hidden w-[46%] flex-col justify-between bg-ink px-12 py-12 lg:flex">
          <Logo tone="light" />

          <div>
            <h2 className="max-w-md text-[30px] font-bold leading-[1.35] tracking-tight text-white">
              결과만 주는 대신,
              <br />
              근거까지 드립니다
            </h2>
            <ul className="mt-8 space-y-3">
              {PRINCIPLES.map((principle) =>
              <li
                key={principle}
                className="flex gap-3 text-[14px] leading-7 text-white/70">
              
                  <span
                  aria-hidden="true"
                  className="mt-3 h-1 w-1 shrink-0 rounded-full bg-accent" />
              
                  {principle}
                </li>
              )}
            </ul>
          </div>

          {/* /40 은 bg-ink 위에서 대비 3.80 이라 본문 글자로 모자란다 (접근성 보고서 2026-10-22). /60 이면 7.03 */}
          <p className="max-w-md text-[12px] leading-6 text-white/60">{DISCLAIMER}</p>
        </aside>

        <main id={MAIN_ID} tabIndex={-1} className="flex flex-1 items-center justify-center px-6 py-14 outline-none">
          <div className="w-full max-w-[380px]">
            {/* 좁은 화면에서는 왼쪽 판이 없어 여기에 로고를 둔다 */}
            <div className="mb-10 lg:hidden">
              <Logo />
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>);

}

/**
 * 로그인·가입 폼의 입력칸. 흰 바탕에 진한 테두리(edge)다. 틀린 칸은 aria-invalid 로 테두리가 빨개진다 (C91).
 * placeholder 를 흐리게(/70) 두면 흰 바탕 대비가 2.67 이라 읽히지 않는다 (C70)
 */
export const AUTH_INPUT =
'mt-1.5 w-full rounded-xl border border-edge bg-canvas px-3.5 py-2.5 text-[14px] text-ink placeholder:text-muted aria-[invalid=true]:border-deny disabled:bg-surface disabled:text-ink2';
export const AUTH_LABEL = 'block text-[13px] font-normal text-ink2';
/**
 * 로그인·가입의 버튼은 ui Button(size md, w-full)이다 (C90). 아래 둘은 아직 Button 으로 옮기지 않은
 * 카카오 콜백 화면만 쓴다. 모양은 Button md 와 같다
 */
/** 칸 바로 아래의 오류 한 줄. 칸에는 aria-describedby 로 잇는다 */
export const AUTH_FIELD_ERROR = 'mt-1.5 text-[13px] text-deny';
