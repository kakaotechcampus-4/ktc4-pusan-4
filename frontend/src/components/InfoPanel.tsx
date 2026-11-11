import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button, cn } from './ui';

/** 제목 줄 오른쪽 그림 버튼(IconButton)의 여백. 36px 버튼이 제목 줄을 키우지 않고 오른쪽 끝이 본문 여백에 맞는다 */
export const PANEL_ICON = '-my-1.5 -mr-2.5';

/**
 * 줄 모양 상자의 본문 여백. 넓은 화면에서는 제목 글자와 같은 선에서 시작한다(여백 20 + 그림 32 + 사이 12)
 */
export const PANEL_BODY = 'px-5 sm:pl-16 sm:pr-6';

/**
 * 판정 전 확인과 내 정보가 입력 하나씩을 보여 주는 흰 상자. 제목 옆 그림으로 상자를 알아보게 하고,
 * 제목 밑 괘선은 두지 않는다(11/11 치오). action 은 제목 줄 오른쪽의 그림 버튼 하나다 (문진 고치기, 다시 올리기).
 * danger 는 탈퇴 상자다
 */
export function InfoPanel({
  title,
  icon: Icon,
  tone = 'default',
  action,
  children





}: {title: string;icon: LucideIcon;tone?: 'default' | 'danger';action?: React.ReactNode;children: React.ReactNode;}) {
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-line">
      <div className="flex items-center justify-between gap-3 px-5 pb-1.5 pt-[18px]">
        <h2 className="flex items-center gap-3 text-body-lg font-bold text-ink">
          <span
            aria-hidden="true"
            className={cn(
              'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]',
              tone === 'danger' ? 'bg-deny-bg text-deny' : 'bg-accent-soft text-accent'
            )}>

            <Icon className="h-[18px] w-[18px]" />
          </span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>);

}

/**
 * 이름과 값. rows 는 이름 옆에 값을 두는 줄이고(내 정보), tiles 는 이름과 값을 회색 칸 하나에 묶어
 * 넓은 화면은 셋, 좁은 화면은 둘씩 놓는다(판정 전 확인). 판정을 시작하기 전에 훑어보는 요약이라 값을 굵게 둔다
 */
export function InfoRows({ rows, variant = 'rows' }: {rows: {term: string;value: string;}[];variant?: 'rows' | 'tiles';}) {
  if (variant === 'tiles')
  return (
    <dl className="grid grid-cols-2 gap-2 px-5 pb-5 pt-2 sm:grid-cols-3">
        {rows.map((row) =>
      // 좁은 화면(두 칸)에서 홀수 개의 마지막 칸이 혼자 남지 않게 줄을 채운다
      <div
        key={row.term}
        className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-surface px-3.5 py-3 [&:last-child:nth-child(odd)]:col-span-2 sm:[&:last-child:nth-child(odd)]:col-span-1">
            <dt className="text-caption text-muted">{row.term}</dt>
            <dd className="text-body-lg font-bold leading-[22px] tabular-nums text-ink [overflow-wrap:anywhere] [word-break:keep-all]">
              {row.value}
            </dd>
          </div>
      )}
      </dl>);

  return (
    <dl className="pb-3.5 pt-0.5">
      {rows.map((row) =>
      <div key={row.term} className={cn('flex items-baseline gap-4 py-[7px]', PANEL_BODY)}>
          <dt className="w-28 shrink-0 text-small text-muted sm:w-36">{row.term}</dt>
          <dd className="min-w-0 text-body font-semibold tabular-nums text-ink [overflow-wrap:anywhere]">{row.value}</dd>
        </div>
      )}
    </dl>);

}

/** 읽는 중, 아직 없음 */
export function PanelNote({ children }: {children: React.ReactNode;}) {
  return <p className="px-5 pb-4 pt-1 text-small text-ink2">{children}</p>;
}

/** 못 읽은 것을 「없다」로 그리지 않는다 (C56, C57) */
export function PanelFailed({ onRetry, children }: {onRetry: () => void;children: React.ReactNode;}) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-5 pb-4 pt-1">
      <p role="alert" className="text-small text-deny">{children}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>다시 시도</Button>
    </div>);

}
