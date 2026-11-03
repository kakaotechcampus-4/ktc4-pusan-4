import React, { useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { OrbitStage } from './OrbitStage';
import { FLOW_STEPS, NOT_DOING } from '../mock/marketing';

/**
 * 메인 맨 위 큰 판. 세 장을 좌우로 넘겨 본다.
 *
 * ExampleCarousel 과 같은 스크롤 스냅이다. 폭을 재서 transform 으로 미는 방식은 한 줄에
 * 몇 장 보이는지를 자바스크립트가 알아야 하는데, 스냅은 브라우저가 알아서 맞추고
 * 손가락·트랙패드로도 그대로 넘어간다.
 */
const SLIDE_COUNT = 3;

/** 장면 하나. 높이는 셋이 같아야 넘길 때 판이 들썩이지 않는다 */
function Slide({ children }: {children: React.ReactNode;}) {
  return (
    <li className="relative min-h-[440px] w-full shrink-0 snap-start overflow-hidden bg-surface2 lg:min-h-[621px]">
      {children}
    </li>);

}

/**
 * 도식 한 칸. 아래 항목과 같은 3열 격자에 올라가고 왼쪽 끝을 글과 맞춘다.
 * 칸마다 그 항목이 무엇인지 그린다 — 셋이 같은 그림이면 칸을 나눈 뜻이 없다
 */
function FigureCell({ children }: {children: React.ReactNode;}) {
  return (
    <svg
      viewBox="0 0 200 120"
      preserveAspectRatio="xMinYMid meet"
      className="h-[104px] w-full lg:h-[124px]">

      {children}
    </svg>);

}

function FigureGrid({ children }: {children: React.ReactNode;}) {
  return (
    <div className="hidden w-full grid-cols-3 gap-6 sm:grid" aria-hidden="true">
      {children}
    </div>);

}

/**
 * 판정 흐름. 칸마다 그 단계를 그린다 —
 * 올린 거래 목록 / 문진에 답한 카드 / 세 갈래로 갈린 결과
 */
function FlowFigure() {
  return (
    <FigureGrid>
      {/* 1. 카드내역 올리기 — 올라온 거래 줄들 */}
      <FigureCell>
        {[
        { y: 16, width: 150, opacity: 0.55 },
        { y: 42, width: 112, opacity: 0.4 },
        { y: 68, width: 166, opacity: 0.4 },
        { y: 94, width: 92, opacity: 0.25 }].
        map((row) =>
        <rect
          key={row.y}
          x="0"
          y={row.y}
          width={row.width}
          height="12"
          rx="6"
          fill="#FFFFFF"
          fillOpacity={row.opacity} />

        )}
      </FigureCell>

      {/* 2. 사업자 문진 — 고른 답이 하나 노랗게 차 있다 */}
      <FigureCell>
        <rect x="0" y="8" width="178" height="104" rx="16" fill="#FFFFFF" fillOpacity="0.07" stroke="#FFFFFF" strokeOpacity="0.28" strokeWidth="2" />
        <rect x="22" y="32" width="88" height="10" rx="5" fill="#FFFFFF" />
        <rect x="22" y="56" width="134" height="10" rx="5" fill="#FFFFFF" fillOpacity="0.4" />
        <rect x="22" y="80" width="58" height="10" rx="5" fill="#FFE600" />
      </FigureCell>

      {/* 3. 건별 판정과 근거 — 가능·확인 필요·불가 */}
      <FigureCell>
        {[
        { y: 24, width: 158, color: '#12B76A' },
        { y: 60, width: 120, color: '#F7A51B' },
        { y: 96, width: 82, color: '#FF5A5A' }].
        map((lane) =>
        <g key={lane.y}>
            <circle cx="8" cy={lane.y} r="8" fill={lane.color} />
            <rect x="24" y={lane.y - 7} width={lane.width} height="14" rx="7" fill={lane.color} />
          </g>
        )}
      </FigureCell>
    </FigureGrid>);

}

/**
 * 하지 않는 일을 그 자리에 하나씩 그리고 빨간 금을 긋는다.
 * 금 밑에 판 바탕색으로 한 번 더 그어 틈을 낸다 — 안 그러면 금이 그림을 덮어 뭉갠다
 */
function Forbidden({ children }: {children: React.ReactNode;}) {
  return (
    <>
      <rect x="2" y="4" width="112" height="112" rx="26" fill="#FFFFFF" fillOpacity="0.05" stroke="#FFFFFF" strokeOpacity="0.2" strokeWidth="2" />
      {children}
      <line x1="22" y1="98" x2="94" y2="22" stroke="#152F56" strokeWidth="13" strokeLinecap="round" />
      <line x1="22" y1="98" x2="94" y2="22" stroke="#FF5A5A" strokeWidth="5" strokeLinecap="round" />
    </>);

}

/**
 * 하지 않는 일. 칸마다 다른 것을 그린다 —
 * 홈택스로 올려보내기 / 세액을 확정해 내놓기 / 밖으로 내보내기
 */
function NotDoingFigure() {
  return (
    <FigureGrid>
      {/* 1. 전자신고·홈택스 제출 — 서류를 위로 올려보낸다 */}
      <FigureCell>
        <Forbidden>
          <rect x="40" y="46" width="36" height="46" rx="6" fill="#FFFFFF" fillOpacity="0.6" />
          <path d="M58 42V22" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="6" strokeLinecap="round" />
          <path d="M44 34l14-14 14 14" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Forbidden>
      </FigureCell>

      {/* 2. 세액 확정 제시 — 줄을 긋고 아래에 확정 금액을 적는다 */}
      <FigureCell>
        <Forbidden>
          <rect x="34" y="36" width="48" height="8" rx="4" fill="#FFFFFF" fillOpacity="0.6" />
          <rect x="34" y="52" width="32" height="8" rx="4" fill="#FFFFFF" fillOpacity="0.6" />
          <rect x="30" y="70" width="56" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.6" />
          <rect x="34" y="80" width="48" height="12" rx="6" fill="#FFFFFF" fillOpacity="0.7" />
        </Forbidden>
      </FigureCell>

      {/* 3. 금전 이동·외부 발송 — 상자 밖으로 내보낸다 */}
      <FigureCell>
        <Forbidden>
          <path d="M44 38H32v40h12" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M50 58h34" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="6" strokeLinecap="round" />
          <path d="M72 46l14 12-14 12" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Forbidden>
      </FigureCell>
    </FigureGrid>);

}

/**
 * 2·3번 장면. 첫 장면과 글 자리를 맞춘다.
 * 아래쪽은 왼쪽 「바로가기」와 오른쪽 숫자가 지나가므로 비워 둔다
 */
function TextSlide({
  eyebrow,
  title,
  items,
  figure




}: {eyebrow: string; title: string; items: string[]; figure: React.ReactNode;}) {
  return (
    <div className="absolute inset-0 flex flex-col px-8 pt-12 sm:px-16 sm:pt-16">
      <p className="text-body text-highlight">{eyebrow}</p>
      <strong className="mt-5 block whitespace-pre-line text-h2 font-normal leading-tight tracking-ir text-white [word-break:keep-all] lg:text-ir-display">
        {title}
      </strong>
      {/* 도식은 제목과 항목 사이 빈 자리를 채운다. 좁은 화면에서는 자리가 없어 숨는다 */}
      <div className="flex min-h-0 flex-1 items-center sm:py-8">{figure}</div>
      <ul className="grid gap-6 pb-24 sm:grid-cols-3">
        {items.map((item) =>
        <li key={item} className="border-t border-white/20 pt-5">
            <strong className="block text-h4 font-bold leading-tight tracking-ir-sm text-white [word-break:keep-all]">
              {item}
            </strong>
          </li>
        )}
      </ul>
    </div>);

}

export function HeroBanner() {
  const track = useRef<HTMLUListElement>(null);
  const [page, setPage] = useState(0);

  const move = (direction: -1 | 1) => {
    const el = track.current;
    if (!el) return;
    const next = Math.min(Math.max(page + direction, 0), SLIDE_COUNT - 1);
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: next * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
  };

  return (
    <div className="relative">
      <ul
        ref={track}
        onScroll={() => {
          const el = track.current;
          if (el) setPage(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-[20px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

        <Slide>
          <OrbitStage />
          {/* 글은 궤도 위에 올린다 */}
          <div className="relative z-10 px-8 pt-12 sm:px-16 sm:pt-16">
            <p className="text-body text-highlight">
              1인 IT 개발 사업자를 위한 경비 판정
            </p>
            <strong className="mt-5 block text-h2 font-normal leading-tight tracking-ir text-white [word-break:keep-all] lg:text-ir-display">
              이 카드값이 경비인지,
              <br />
              조문까지 붙여 답합니다
            </strong>
          </div>
        </Slide>

        <Slide>
          <TextSlide
            eyebrow="판정 흐름"
            title={'카드내역 한 번에\n건별 판정까지'}
            items={FLOW_STEPS.slice(0, 3).map((step) => step.title)}
            figure={<FlowFigure />} />

        </Slide>

        <Slide>
          <TextSlide
            eyebrow="하지 않는 일"
            title={'할 수 있는 것보다\n하지 않는 것을 먼저'}
            items={NOT_DOING.map((item) => item.title)}
            figure={<NotDoingFigure />} />

        </Slide>
      </ul>

      {/*
        오른쪽 아래 현재/전체. 왼쪽 아래는 「바로가기」가 베어 낸 자리라,
        좁은 화면에서는 그 띠(72px)를 피해 위로 올린다
      */}
      <div className="absolute bottom-24 right-6 z-20 flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-small text-white/80 sm:bottom-8 sm:right-8">
        <button
          type="button"
          aria-label="이전 장면"
          disabled={page === 0}
          onClick={() => move(-1)}
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent">

          <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="px-1 tabular-nums" aria-live="polite">
          {page + 1} / {SLIDE_COUNT}
        </span>
        <button
          type="button"
          aria-label="다음 장면"
          disabled={page === SLIDE_COUNT - 1}
          onClick={() => move(1)}
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent">

          <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>);

}
