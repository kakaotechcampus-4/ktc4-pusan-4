import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { MarketingHeader } from '../components/MarketingHeader';
import { MarketingFooter } from '../components/MarketingFooter';
import { OrbitStage } from '../components/OrbitStage';
import {
  FLOW_STEPS,
  HERO_SUMMARY,
  NOT_DOING,
  STATS,
  SYSTEM_FEATURES } from
'../mock/marketing';

const won = (value: number) => value.toLocaleString('ko-KR');

/** 본문 폭과 좌우 여백. 레퍼런스는 1440 폭에서 좌우 62px 를 띄운다 */
const SHELL = 'mx-auto w-full max-w-page px-6 lg:px-gutter';

/** 검정 동그라미에 흰 화살표. 레퍼런스가 모든 「바로가기」에 쓰는 표시 */
function ArrowDot({ size = 'md' }: {size?: 'sm' | 'md';}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-ink text-white ${
      size === 'sm' ? 'h-5 w-5' : 'h-8 w-8'}`
      }>

      <ArrowRightIcon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
    </span>);

}

/**
 * 섹션 제목. 레퍼런스는 글자 앞에 48×48 그림을 두고 글자는 48px 굵기 400 이다.
 * 그림은 카카오 자산이라 가져오지 않고, 같은 자리에 우리 로고 막대를 둔다.
 */
function IrHeading({ children }: {children: React.ReactNode;}) {
  return (
    <h2 className="flex items-center gap-4 text-h2 font-normal tracking-ir text-ink lg:text-ir-section">
      <span
        aria-hidden="true"
        className="flex h-12 w-12 shrink-0 items-center justify-center gap-[3px] rounded-xl bg-surface">

        <span className="block h-5 w-[5px] rounded-sm bg-ink" />
        <span className="block h-5 w-[5px] rounded-sm bg-ink" />
        <span className="block h-5 w-[5px] rounded-sm bg-highlight" />
      </span>
      {children}
    </h2>);

}

/** 패널 제목 아래 「항목 — 바로가기」 한 줄 */
function BoardRow({ to, label }: {to: string; label: string;}) {
  return (
    <li className="border-t border-accent-line first:border-t-0">
      <Link
        to={to}
        className="flex items-center justify-between gap-3 py-4 text-body text-ink2 transition-colors hover:text-ink">

        <span>{label}</span>
        <span className="flex items-center gap-1.5 text-small text-muted">
          바로가기
          <ArrowDot size="sm" />
        </span>
      </Link>
    </li>);

}

const BOARDS = [
{
  title: '카드내역',
  rows: [
  { to: '/upload', label: '카드내역 올리기' },
  { to: '/uploads', label: '업로드 이력' }]

},
{
  title: '판정',
  rows: [
  { to: '/results', label: '판정 결과' },
  { to: '/questions', label: '되묻기' }]

},
{
  title: '자료',
  rows: [
  { to: '/transactions', label: '거래 목록' },
  { to: '/summary', label: '세무사 전달 요약' }]

}];


export function Landing() {
  const [ok, ask] = HERO_SUMMARY.distribution;

  return (
    <div className="min-h-full bg-canvas">
      <MarketingHeader />

      <main>
        {/* 큰 패널 + 오른쪽 세로 띠 (레퍼런스 section_visual: 1094 / 206, 사이 16) */}
        <section className={`${SHELL} pt-10`}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_206px]">
            <div className="relative">
              <div className="relative min-h-[440px] overflow-hidden rounded-[20px] bg-surface2 lg:min-h-[621px]">
                <OrbitStage />

                {/* 글은 궤도 위에 올린다 */}
                <div className="relative z-10 px-8 pt-12 sm:px-16 sm:pt-16">
                  <p className="text-body text-ink2">
                    1인 IT 개발 사업자를 위한 경비 판정
                  </p>
                  <strong className="mt-5 block text-h2 font-normal leading-tight tracking-ir text-ink [word-break:keep-all] lg:text-ir-display">
                    이 카드값이 경비인지,
                    <br />
                    조문까지 붙여 답합니다
                  </strong>
                </div>
              </div>

              {/* 왼쪽 아래 모서리를 바탕색으로 베어 내고 그 자리에 링크를 둔다 */}
              <div className="absolute bottom-0 left-0 flex h-[72px] items-center rounded-tr-[20px] bg-canvas pr-7 pt-2">
                <Link
                  to="/login"
                  className="flex items-center gap-3 text-ir-lead font-normal tracking-ir-xs text-ink">

                  무료로 판정해보기
                  <ArrowDot />
                </Link>
              </div>
            </div>

            {/* 첫 장은 검정에 큰 숫자, 아래로 회색 (레퍼런스 wrap_banner) */}
            <div className="flex flex-col gap-2">
              <div className="rounded-2xl bg-ink2 p-5 text-white">
                <p className="text-caption text-white/60">이번 달 인정 경비</p>
                <p className="mt-2 whitespace-nowrap text-ir-num font-bold tracking-ir-sm tabular-nums">
                  {won(HERO_SUMMARY.availableAmount)}
                  <span className="ml-0.5 text-body font-normal">원</span>
                </p>
                <p className="mt-2 text-caption text-white/60 tabular-nums">
                  {HERO_SUMMARY.total}건 중 {ok.count}건 가능
                </p>
              </div>

              <div className="rounded-2xl bg-surface p-5">
                <p className="text-caption text-muted">판정 분포</p>
                <ul className="mt-4 space-y-3">
                  {HERO_SUMMARY.distribution.map((item) =>
                  <li key={item.label}>
                      <div className="flex items-baseline justify-between text-small">
                        <span className="text-ink2">{item.label}</span>
                        <span className="font-bold tabular-nums text-ink">
                          {item.count}건
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 w-full rounded-full bg-accent-line">
                        <div
                        className={`h-1 rounded-full ${item.bar}`}
                        style={{
                          width: `${Math.round(item.count / HERO_SUMMARY.total * 100)}%`
                        }} />

                      </div>
                    </li>
                  )}
                </ul>
              </div>

              <div className="flex-1 rounded-2xl bg-surface p-5">
                <p className="text-caption text-muted">지금 할 일</p>
                <p className="mt-2 text-h4 font-bold tracking-ir-sm text-ink">
                  확인 필요 {ask.count}건
                </p>
                <p className="mt-2 text-small leading-6 text-ink2 [word-break:keep-all]">
                  같은 사유끼리 묶어 두었습니다. 답하면 그 자리에서 다시
                  판정합니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 주요현황 — 회색 패널(428×241) 3장 + 카드(428×360) 3장 + 알약 */}
        <section id="flow" className={`${SHELL} pt-28`}>
          <IrHeading>경비판정 주요현황</IrHeading>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {BOARDS.map((board) =>
            <div
              key={board.title}
              className="flex min-h-[241px] flex-col rounded-2xl bg-surface px-8 py-8">

                <strong className="text-h3 font-bold tracking-ir-sm text-ink lg:text-ir-panel">
                  {board.title}
                </strong>
                <ul className="mt-5">
                  {board.rows.map((row) =>
                <BoardRow key={row.to} to={row.to} label={row.label} />
                )}
                </ul>
              </div>
            )}
          </div>

          <ul className="mt-4 grid gap-4 md:grid-cols-3">
            {FLOW_STEPS.slice(0, 3).map((step) =>
            <li key={step.step}>
                <div className="flex h-full min-h-[360px] flex-col rounded-2xl bg-surface px-8 py-8">
                  <span className="inline-flex w-fit items-center rounded-full bg-canvas px-3.5 py-1.5 text-caption text-ink2">
                    {step.step}단계
                  </span>
                  <strong className="mt-auto block text-h3 font-bold leading-tight tracking-ir-sm text-ink [word-break:keep-all] lg:text-ir-panel">
                    {step.title}
                  </strong>
                  <p className="mt-5 text-body leading-6 text-ink2 [word-break:keep-all]">
                    {step.body}
                  </p>
                </div>
              </li>
            )}
          </ul>

          <div className="mt-10 flex justify-center">
            <Link
              to="/login"
              className="inline-flex h-[79px] items-center gap-4 rounded-full bg-surface px-10 text-ir-lead font-normal tracking-ir-xs text-ink transition-colors hover:bg-accent-line">

              판정 흐름 전체보기
              <ArrowDot />
            </Link>
          </div>
        </section>

        {/* 숫자 줄 — 위아래 괘선만 */}
        <section id="evidence" className="mt-28 border-y border-line">
          <dl className={`${SHELL} grid grid-cols-2 gap-10 py-16 md:grid-cols-4`}>
            {STATS.map((stat) =>
            <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <p className="text-h3 font-bold tracking-ir tabular-nums text-ink lg:text-ir-panel">
                    {stat.value}
                  </p>
                  <p className="mt-2.5 text-small text-muted">{stat.label}</p>
                </dd>
              </div>
            )}
          </dl>
        </section>

        {/* 지키는 것 — 회색 패널 3장 */}
        <section id="system" className={`${SHELL} pt-28`}>
          <IrHeading>경비판정이 지키는 것</IrHeading>

          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {SYSTEM_FEATURES.map((feature) =>
            <li
              key={feature.title}
              className="flex min-h-[360px] flex-col rounded-2xl bg-surface px-8 py-8">

                <strong className="block whitespace-pre-line text-h3 font-bold leading-tight tracking-ir-sm text-ink [word-break:keep-all] lg:text-ir-panel">
                  {feature.title}
                </strong>
                <p className="mt-6 flex-1 text-body leading-6 text-ink2 [word-break:keep-all]">
                  {feature.body}
                </p>
                {feature.caption &&
              <p className="mt-6 border-t border-accent-line pt-5 text-small text-muted">
                    {feature.caption}
                  </p>
              }
              </li>
            )}
          </ul>
        </section>

        {/* 하지 않는 일 — 검정 패널 */}
        <section id="scope" className={`${SHELL} pb-28 pt-28`}>
          <div className="rounded-2xl bg-ink px-8 py-14 text-white sm:px-16">
            <h2 className="text-h2 font-normal tracking-ir lg:text-ir-section">
              하지 않는 일
            </h2>
            <ul className="mt-12 grid gap-10 md:grid-cols-3">
              {NOT_DOING.map((item) =>
              <li key={item.title} className="border-t border-white/20 pt-6">
                  <strong className="block text-h3 font-bold tracking-ir-sm lg:text-ir-panel">
                    {item.title}
                  </strong>
                  <p className="mt-4 text-body leading-6 text-white/60 [word-break:keep-all]">
                    {item.body}
                  </p>
                </li>
              )}
            </ul>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>);

}
