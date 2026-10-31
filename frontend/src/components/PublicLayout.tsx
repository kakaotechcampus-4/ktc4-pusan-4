import React from 'react';
import { MarketingHeader } from './MarketingHeader';
import { MarketingFooter } from './MarketingFooter';

/** 로그인 없이 보는 안내 화면(약관·처리방침·FAQ·없는 주소). 랜딩과 같은 머리말·꼬리말을 쓴다 */
export function PublicLayout({ children }: {children: React.ReactNode;}) {
  return (
    <div className="flex min-h-full flex-col bg-canvas">
      <MarketingHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-20 pt-10">{children}</main>
      <MarketingFooter />
    </div>);

}

/** 약관·처리방침의 조항 하나 */
export function LegalSection({ title, children }: {title: string;children: React.ReactNode;}) {
  return (
    <section className="mt-10">
      <h2 className="text-h4 font-bold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-body leading-7 text-ink2">{children}</div>
    </section>);

}

/** 문서 첫머리. 시행일은 바뀔 때마다 고친다 */
export function LegalHeader({ title, effective }: {title: string;effective: string;}) {
  return (
    <header>
      <p className="text-small font-bold text-accent">PreeT</p>
      <h1 className="mt-1.5 text-h2 font-bold tracking-tight text-ink">{title}</h1>
      <p className="mt-2 text-small text-muted">시행일 {effective}</p>
    </header>);

}
