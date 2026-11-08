import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { useSession } from '../contexts/SessionContext';
import { signedInHint } from '../contexts/signedInHint';
import icon from '../assets/brand/icon/preet-icon.svg';
import { InterviewCard, UploadRows, VerdictCard } from '../components/flowFigure';
import { MarketingHeader } from '../components/MarketingHeader';
import { MarketingFooter } from '../components/MarketingFooter';
import { HeroBanner } from '../components/HeroBanner';
import { IntroOverlay } from '../components/IntroOverlay';
import { ExampleCarousel } from '../components/ExampleCarousel';
import {
  FLOW_STEPS,
  NOT_DOING,
  RULE_CARD_COUNT,
  SYSTEM_FEATURES,
  VERDICTS } from
'../mock/marketing';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PAGES } from '../seo';
import { MAIN_ID } from '../components/ui';

/**
 * 인트로는 로그인하지 않은 사람이 홈을 새로 열 때마다(새로고침 포함) 띄운다.
 * 한 번 띄운 뒤 로고로 홈에 돌아오면 다시 띄우지 않는다 — 페이지를 새로 열 때까지 기억한다
 */
let introPlayed = false;

/** 움직임을 줄이라는 설정이면 아예 띄우지 않는다. 빌드 때 미리 그리는 HTML(entry-server.tsx)에는 넣지 않는다 */
function wantsIntro() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  return !introPlayed && !signedInHint();
}

/** 본문 폭과 좌우 여백. 레퍼런스는 1440 폭에서 좌우 62px 를 띄운다 */
const SHELL = 'mx-auto w-full max-w-page px-6 lg:px-gutter';

/** 검정 동그라미에 흰 화살표. 레퍼런스가 모든 「바로가기」에 쓰는 표시 */
function ArrowDot({ size = 'md', invert = false }: {size?: 'sm' | 'md';invert?: boolean;}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${
      invert ? 'bg-canvas text-ink' : 'bg-ink text-white'} ${
      size === 'sm' ? 'h-5 w-5' : 'h-8 w-8'}`
      }>

      <ArrowRightIcon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
    </span>);

}

/**
 * 섹션 제목. 레퍼런스는 글자 앞에 48×48 그림을 두고 글자는 48px 굵기 400 이다.
 * 그림은 카카오 자산이라 가져오지 않는다. 같은 자리에 브랜드 앱 아이콘을 둔다 (#247 리뷰).
 */
function IrHeading({ children }: {children: React.ReactNode;}) {
  return (
    <h2 className="flex items-center gap-4 text-h2 font-normal tracking-ir text-ink [word-break:keep-all] lg:text-ir-section">
      {/* 브랜드 앱 아이콘. 둥근 사각형과 바탕을 SVG 가 이미 갖고 있어 타일을 따로 그리지 않는다 */}
      <img src={icon} alt="" aria-hidden="true" className="block h-12 w-12 shrink-0" />
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
  const { status } = useSession();
  useDocumentTitle(PAGES.home.title);

  const [intro, setIntro] = useState(wantsIntro);

  // index.html 이 미리 깔아 둔 판을 걷는다. 인트로가 뜨면 그 아래로 가려져 이어져 보이고, 안 뜨면 본문이 드러난다
  useEffect(() => {
    document.documentElement.classList.remove('intro-cover');
  }, []);

  const closeIntro = useCallback(() => {
    introPlayed = true;
    setIntro(false);
  }, []);

  /* 로그인 뒤에는 메인으로 오므로, CTA 가 로그인 폼으로 되돌아가면 막힌다. 처음 온 사람은 가입부터 한다 (C101) */
  const signedIn = status === 'signedIn';
  const startTo = signedIn ? '/upload' : '/signup';

  return (
    <div className="min-h-full bg-canvas">
      {intro && <IntroOverlay onDone={closeIntro} />}

      <MarketingHeader />

      <main id={MAIN_ID} tabIndex={-1} className="outline-none">
        {/* 큰 패널 + 오른쪽 세로 띠 (레퍼런스 section_visual: 1094 / 206, 사이 16) */}
        <section className={`${SHELL} pt-10`}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_206px]">
            <div className="relative">
              <HeroBanner autoplay={!intro} />

              {/*
                왼쪽 아래 모서리를 베어 낸 자리가 그대로 버튼이다.
                전에는 그 자리를 바탕색(흰색)으로 채우고 글자만 뒀는데, 페이지 바탕과 같은 색이라
                판이 패인 것으로 읽히고 누를 것으로 안 보였다. 흰 자리에 알약을 또 넣으면
                판·흰 상자·알약 세 겹이 된다 — 베어 낸 자리를 통째로 칠한다 (#254 리뷰).
                왼쪽 아래는 판과 같은 20px 으로 깎는다. 각지면 판의 둥근 모서리를 덮어 혼자 튄다
              */}
              <Link
                to={startTo}
                className="absolute bottom-0 left-0 flex h-[76px] items-center gap-3 rounded-bl-[20px] rounded-tr-[20px] bg-ink pl-7 pr-6 text-ir-lead font-normal tracking-ir-xs text-white transition-colors duration-150 ease-snap hover:bg-ink2">

                {signedIn ? '카드내역 올리기' : '무료로 판정해보기'}
                <ArrowDot invert />
              </Link>
            </div>

            {/*
              첫 장은 남색에 큰 숫자, 아래로 회색 (레퍼런스 wrap_banner).
              로그인 전에는 보여 줄 실제 판정 결과가 없다. 지어낸 금액·건수 대신
              세어서 확인되는 것(규칙 카드 수)과 제품이 하는 일만 둔다
            */}
            <div className="flex flex-col gap-2">
              <div className="rounded-2xl bg-surface2 p-5 text-white">
                <p className="text-caption text-white">조문을 읽고 만든 규칙 카드</p>
                <p className="mt-2 whitespace-nowrap text-ir-num font-bold tracking-ir-sm tabular-nums">
                  {RULE_CARD_COUNT}
                  <span className="ml-0.5 text-body font-normal">장</span>
                </p>
                <p className="mt-2 text-caption leading-5 text-white [word-break:keep-all]">
                  판정마다 어느 카드가 걸렸는지 함께 보여줍니다
                </p>
              </div>

              <div className="rounded-2xl bg-surface p-5">
                <p className="text-caption text-muted">판정 세 갈래</p>
                <ul className="mt-4 space-y-3.5">
                  {VERDICTS.map((item) =>
                  <li key={item.label}>
                      <div className="flex items-center gap-1.5 text-small">
                        <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.bar}`}
                        aria-hidden="true" />

                        <span className="font-bold text-ink">{item.label}</span>
                      </div>
                      <p className="mt-1 text-caption leading-5 text-ink2 [word-break:keep-all]">
                        {item.body}
                      </p>
                    </li>
                  )}
                </ul>
              </div>

              <div className="flex-1 rounded-2xl bg-surface p-5">
                <p className="text-caption text-muted">되돌릴 수 없는 동작</p>
                <p className="mt-2 text-h4 font-bold tracking-ir-sm text-ink">
                  만들지 않습니다
                </p>
                <p className="mt-2 text-small leading-6 text-ink2 [word-break:keep-all]">
                  신고, 제출, 발송은 하지 않습니다. 답을 고치면 그 자리에서 다시
                  판정합니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 주요현황 — 회색 패널(428×241) 3장 + 카드(428×360) 3장 + 알약 */}
        <section id="flow" className={`${SHELL} pt-28`}>
          <IrHeading>PreeT 주요현황</IrHeading>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {BOARDS.map((board) =>
            <div
              key={board.title}
              className="flex min-h-[241px] flex-col rounded-2xl bg-accent-soft px-8 py-8">

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
            {FLOW_STEPS.slice(0, 3).map((step, index) =>
            <li key={step.step}>
                <div className="flex h-full min-h-[360px] flex-col rounded-2xl bg-accent-soft px-8 py-8">
                  <span className="inline-flex w-fit items-center rounded-full bg-canvas px-3.5 py-1.5 text-caption text-ink2">
                    {step.step}단계
                  </span>
                  {/*
                    히어로 2번 장면과 같은 그림을 그 단계 칸에 하나씩 둔다 (#247 리뷰).
                    같은 말을 위에서는 그림으로, 여기서는 글로만 하고 있었고 그 자리가 비어
                    그림이 빠진 것처럼 보였다. 연파랑 판이라 색만 light 로 바꿔 쓴다
                  */}
                  <div className="mt-6 flex flex-1 items-center">
                    {[
                    <UploadRows key="upload" tone="light" />,
                    <InterviewCard key="interview" tone="light" />,
                    <VerdictCard key="verdict" tone="light" />][
                    index]}
                  </div>
                  <strong className="block text-h3 font-bold leading-tight tracking-ir-sm text-ink [word-break:keep-all] lg:text-ir-panel">
                    {step.title}
                  </strong>
                  <p className="mt-5 text-body leading-6 text-ink2 [word-break:keep-all]">
                    {step.body}
                  </p>
                </div>
              </li>
            )}
          </ul>

        </section>

        {/* 지출 예시 — 가로로 넘겨 본다 */}
        <section className={`${SHELL} pt-28`}>
          <IrHeading>이런 지출을 이렇게 봅니다</IrHeading>
          <p className="mt-5 max-w-xl text-body-lg text-ink2 [word-break:keep-all]">
            1인 개발 사업자가 자주 쓰는 항목입니다. 같은 지출도 상황에 따라
            결과가 달라집니다.
          </p>
          <div className="mt-10">
            <ExampleCarousel />
          </div>
        </section>

        {/* 지키는 것 — 회색 패널 3장 */}
        <section id="system" className={`${SHELL} pt-28`}>
          <IrHeading>PreeT가 지키는 것</IrHeading>

          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {SYSTEM_FEATURES.map((feature) =>
            <li
              key={feature.title}
              className="flex min-h-[360px] flex-col rounded-2xl bg-accent-soft px-8 py-8">

                <strong className="block whitespace-pre-line text-h3 font-bold leading-tight tracking-ir-sm text-ink [word-break:keep-all] lg:text-ir-panel">
                  {feature.title}
                </strong>
                <p className="mt-6 flex-1 text-body leading-6 text-ink2 [word-break:keep-all]">
                  {feature.body}
                </p>
                {feature.caption &&
              <p className="mt-6 border-t border-accent-line pt-5 text-small text-ink2">
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
