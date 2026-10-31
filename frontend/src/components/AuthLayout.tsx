import React from 'react';
import { Link } from 'react-router-dom';

const PRINCIPLES = [
'판정마다 조문의 시행 버전을 붙입니다',
'근거를 못 붙이면 가능·불가로 저장하지 않습니다',
'카드내역 원본은 서버로 올라가지 않습니다'];


/** 로그인·가입·카카오 콜백이 같이 쓰는 틀. 왼쪽은 브랜드 패널(lg 이상), 오른쪽은 폼 */
export function AuthLayout({ children }: {children: React.ReactNode;}) {
  return (
    <div className="flex min-h-full w-full bg-surface">
      {/* 좌측 브랜드 패널 */}
      <aside className="hidden w-[46%] flex-col justify-between bg-ink px-12 py-12 lg:flex">
        <Link to="/" className="flex items-center gap-2" aria-label="PreeT 홈">
          <span aria-hidden="true" className="flex gap-[3px]">
            <span className="block h-5 w-[5px] rounded-sm bg-white" />
            <span className="block h-5 w-[5px] rounded-sm bg-white" />
            <span className="block h-5 w-[5px] rounded-sm bg-accent" />
          </span>
          <span className="text-[17px] font-bold tracking-tight text-white">
            PreeT
          </span>
        </Link>

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

        <p className="max-w-md text-[12px] leading-6 text-white/40">
          이 서비스는 확인할 항목과 근거까지만 제시합니다. 세액을 확정하거나 세무
          신고를 대리하지 않습니다.
        </p>
      </aside>

      <div className="flex flex-1 items-center justify-center px-6 py-14">
        <div className="w-full max-w-[380px]">
          <Link
            to="/"
            className="mb-10 flex items-center gap-2 lg:hidden"
            aria-label="PreeT 홈">
            
            <span aria-hidden="true" className="flex gap-[3px]">
              <span className="block h-5 w-[5px] rounded-sm bg-ink" />
              <span className="block h-5 w-[5px] rounded-sm bg-ink" />
              <span className="block h-5 w-[5px] rounded-sm bg-accent" />
            </span>
            <span className="text-[17px] font-bold tracking-tight text-ink">
              PreeT
            </span>
          </Link>
          {children}
        </div>
      </div>
    </div>);

}

/** 로그인·가입 폼의 입력칸. 로그인 화면의 기존 모양 그대로다 */
export const AUTH_INPUT =
'mt-1.5 w-full rounded-xl border border-line px-3.5 py-2.5 text-[14px] text-ink placeholder:text-muted/70 disabled:bg-canvas disabled:text-muted';
export const AUTH_LABEL = 'block text-[13px] font-normal text-ink2';
export const AUTH_PRIMARY =
'w-full rounded-xl bg-accent px-4 py-3 text-[15px] font-bold text-white transition-colors duration-150 ease-snap hover:bg-accent-hover disabled:opacity-60';
export const AUTH_SECONDARY =
'w-full rounded-xl border border-line px-4 py-3 text-[14px] font-bold text-ink transition-colors duration-150 ease-snap hover:bg-canvas disabled:opacity-60';
