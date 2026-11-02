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
 * 2·3번 장면. 첫 장면과 글 자리를 맞춘다.
 * 아래쪽은 왼쪽 「바로가기」와 오른쪽 숫자가 지나가므로 비워 둔다
 */
function TextSlide({
  eyebrow,
  title,
  items




}: {eyebrow: string; title: string; items: string[];}) {
  return (
    <div className="absolute inset-0 flex flex-col px-8 pt-12 sm:px-16 sm:pt-16">
      <p className="text-body text-highlight">{eyebrow}</p>
      <strong className="mt-5 block whitespace-pre-line text-h2 font-normal leading-tight tracking-ir text-white [word-break:keep-all] lg:text-ir-display">
        {title}
      </strong>
      <ul className="mt-auto grid gap-6 pb-24 sm:grid-cols-3">
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
            items={FLOW_STEPS.slice(0, 3).map((step) => step.title)} />

        </Slide>

        <Slide>
          <TextSlide
            eyebrow="하지 않는 일"
            title={'할 수 있는 것보다\n하지 않는 것을 먼저'}
            items={NOT_DOING.map((item) => item.title)} />

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
