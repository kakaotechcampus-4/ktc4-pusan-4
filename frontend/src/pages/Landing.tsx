import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { MarketingHeader } from '../components/MarketingHeader';
import { MarketingFooter } from '../components/MarketingFooter';
import {
  FLOW_STEPS,
  HERO_SUMMARY,
  NOT_DOING,
  STATS,
  SYSTEM_FEATURES } from
'../mock/marketing';

const won = (value: number) => value.toLocaleString('ko-KR');

/** 검정 동그라미에 흰 화살표. 레퍼런스가 모든 「바로가기」에 쓰는 표시 */
function ArrowDot({ size = 'md' }: {size?: 'sm' | 'md';}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-ink text-white ${
      size === 'sm' ? 'h-5 w-5' : 'h-7 w-7'}`
      }>

      <ArrowRightIcon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
    </span>);

}

/** 패널 제목 아래 「항목 — 바로가기」 한 줄 */
function BoardRow({ to, label }: {to: string; label: string;}) {
  return (
    <li className="border-t border-accent-line first:border-t-0">
      <Link
        to={to}
        className="flex items-center justify-between gap-3 py-3.5 text-body text-ink2 transition-colors hover:text-ink">

        <span>{label}</span>
        <span className="flex items-center gap-1.5 text-small text-muted">
          바로가기
          <ArrowDot size="sm" />
        </span>
      </Link>
    </li>);

}

/** 레퍼런스의 섹션 제목 — 앞에 표시 하나, 뒤에 큰 굵은 글씨 */
function IrHeading({ mark, children }: {mark: string; children: React.ReactNode;}) {
  return (
    <h2 className="flex items-center gap-3 text-h2 font-bold text-ink sm:text-h2-lg">
      <span aria-hidden="true">{mark}</span>
      {children}
    </h2>);

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
        {/* 1. 큰 패널 + 오른쪽 세로 카드 더미 (레퍼런스 section_visual) */}
        <section className="mx-auto w-full max-w-page px-6 pt-10">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
            <div className="relative">
              <div className="relative flex min-h-[420px] flex-col justify-center overflow-hidden rounded-[20px] bg-highlight px-8 pb-28 pt-12 sm:min-h-[486px] sm:px-16 sm:pb-24 sm:pt-0">
                <p className="text-body font-bold text-ink2">
                  1인 IT 개발 사업자를 위한 경비 판정
                </p>
                <strong className="mt-5 block text-h2 font-bold leading-tight text-ink [word-break:keep-all] sm:text-h1 lg:text-h1-lg">
                  이 카드값이 경비인지,
                  <br />
                  조문까지 붙여 답합니다
                </strong>
                <p className="mt-6 max-w-md text-body-lg text-ink2 [word-break:keep-all]">
                  판정은 검수를 마친 규칙 카드가 내리고, AI 는 가맹점 이름을
                  업종으로 분류하는 데까지만 씁니다.
                </p>
              </div>

              {/* 왼쪽 아래 모서리를 흰색으로 베어 낸 자리에 링크를 둔다 */}
              <div className="absolute bottom-0 left-0 flex h-16 items-center rounded-tr-[20px] bg-canvas pr-6 pt-2">
                <Link
                  to="/login"
                  className="flex items-center gap-2 text-body font-bold text-ink">

                  무료로 판정해보기
                  <ArrowDot />
                </Link>
              </div>
            </div>

            {/* 오른쪽 띠 — 첫 장은 검정, 아래로 회색 (레퍼런스 wrap_banner) */}
            <div className="flex flex-col gap-2">
              <div className="rounded-2xl bg-ink2 p-5 text-white">
                <p className="text-caption text-white/60">이번 달 인정 경비</p>
                <p className="mt-2 whitespace-nowrap text-h3-lg font-bold tabular-nums">
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
                <p className="mt-2 text-h4 font-bold text-ink">
                  확인 필요 {ask.count}건
                </p>
                <p className="mt-2 text-small leading-6 text-ink2">
                  같은 사유끼리 묶어 두었습니다. 답하면 그 자리에서 다시
                  판정합니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 2. 주요현황 — 회색 패널 3장 + 카드 3장 + 전체보기 알약 */}
        <section id="flow" className="mx-auto w-full max-w-page px-6 pt-24">
          <IrHeading mark="📂">경비판정 주요현황</IrHeading>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {BOARDS.map((board) =>
            <div key={board.title} className="rounded-2xl bg-surface px-6 py-6">
                <strong className="text-h4 font-bold text-ink">
                  {board.title}
                </strong>
                <ul className="mt-3">
                  {board.rows.map((row) =>
                <BoardRow key={row.to} to={row.to} label={row.label} />
                )}
                </ul>
              </div>
            )}
          </div>

          <ul className="mt-5 grid gap-4 md:grid-cols-3">
            {FLOW_STEPS.slice(0, 3).map((step) =>
            <li key={step.step}>
                <div className="flex h-full flex-col rounded-2xl bg-surface px-7 py-7">
                  <span className="inline-flex w-fit items-center rounded-full bg-canvas px-3 py-1 text-caption font-bold text-ink2">
                    {step.step}단계
                  </span>
                  <strong className="mt-5 block text-h4 font-bold leading-7 text-ink [word-break:keep-all]">
                    {step.title}
                  </strong>
                  <p className="mt-3 text-body leading-6 text-ink2">
                    {step.body}
                  </p>
                </div>
              </li>
            )}
          </ul>

          <div className="mt-8 flex justify-center">
            <Link
              to="/login"
              className="inline-flex h-[58px] items-center gap-3 rounded-[36px] bg-surface px-8 text-body font-bold text-ink transition-colors hover:bg-accent-line">

              판정 흐름 전체보기
              <ArrowDot />
            </Link>
          </div>
        </section>

        {/* 3. 숫자 줄 — 위아래 괘선만 */}
        <section id="evidence" className="mt-24 border-y border-line">
          <dl className="mx-auto grid w-full max-w-page grid-cols-2 gap-8 px-6 py-14 md:grid-cols-4">
            {STATS.map((stat) =>
            <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <p className="text-h2 font-bold tabular-nums text-ink sm:text-h2-lg">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-small text-muted">{stat.label}</p>
                </dd>
              </div>
            )}
          </dl>
        </section>

        {/* 4. 만드는 방식 — 회색 패널 3장 */}
        <section id="system" className="mx-auto w-full max-w-page px-6 pt-24">
          <IrHeading mark="📐">경비판정이 지키는 것</IrHeading>

          <ul className="mt-8 grid gap-3 md:grid-cols-3">
            {SYSTEM_FEATURES.map((feature) =>
            <li
              key={feature.title}
              className="flex flex-col rounded-2xl bg-surface px-7 py-8">

                <strong className="block whitespace-pre-line text-h4 font-bold leading-7 text-ink [word-break:keep-all]">
                  {feature.title}
                </strong>
                <p className="mt-4 flex-1 text-body leading-6 text-ink2">
                  {feature.body}
                </p>
                {feature.caption &&
              <p className="mt-5 border-t border-accent-line pt-4 text-small text-muted">
                    {feature.caption}
                  </p>
              }
              </li>
            )}
          </ul>
        </section>

        {/* 5. 하지 않는 일 — 검정 패널 */}
        <section id="scope" className="mx-auto w-full max-w-page px-6 pb-24 pt-24">
          <div className="rounded-2xl bg-ink px-8 py-12 text-white sm:px-14">
            <h2 className="text-h2 font-bold sm:text-h2-lg">하지 않는 일</h2>
            <ul className="mt-10 grid gap-10 md:grid-cols-3">
              {NOT_DOING.map((item) =>
              <li key={item.title} className="border-t border-white/20 pt-5">
                  <strong className="block text-h4 font-bold">
                    {item.title}
                  </strong>
                  <p className="mt-3 text-body leading-6 text-white/60">
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
