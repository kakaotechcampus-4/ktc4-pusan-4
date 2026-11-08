import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from 'lucide-react';
import { OrbitStage } from './OrbitStage';
import { InterviewCard, UploadRows, VerdictCard } from './flowFigure';
import { FLOW_STEPS, NOT_DOING } from '../mock/marketing';

/**
 * 메인 맨 위 큰 판. 세 장을 좌우로 넘겨 본다.
 *
 * ExampleCarousel 과 같은 스크롤 스냅이다. 폭을 재서 transform 으로 미는 방식은 한 줄에
 * 몇 장 보이는지를 자바스크립트가 알아야 하는데, 스냅은 브라우저가 알아서 맞추고
 * 손가락·트랙패드로도 그대로 넘어간다.
 *
 * 4초마다 저절로 다음 장면으로 넘어가고, 3 다음은 1 이다. 알약의 ⏸ 로 멈춘다(WCAG 2.2.2).
 */
const SLIDE_COUNT = 3;

/** 저절로 넘어가는 간격. 손으로 넘기면 거기서 다시 센다 */
const AUTOPLAY_MS = 4000;

/**
 * 끝을 넘어 도는 중인 상태. 갈 장면(slide)을 지금 장면 옆으로 옮겨 붙여 둔 것이다.
 * step 1 은 1번을 3번 뒤로, -1 은 3번을 1번 앞으로 옮겼다는 뜻이다
 */
type Wrap = {slide: HTMLElement;step: 1 | -1;};

/** 지금 보이는 장면 번호. 도는 중이면 옮겨 붙인 만큼 되돌려 센다 */
function pageOf(el: HTMLElement, wrap: Wrap | null) {
  const at = Math.round(el.scrollLeft / el.clientWidth);
  return wrap ? (at + wrap.step + SLIDE_COUNT) % SLIDE_COUNT : at;
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

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
 * 2·3번 장면 뒤에 까는 궤도 테. 1번 장면(OrbitStage)과 중심·크기가 같고 그림과 문구만 없다.
 * 제목과 도식 사이가 비어 보인다는 지적 때문에 넣었다 (#238 리뷰) — 세 장면이 한 판으로 읽힌다.
 * 글과 도식보다 연하게 둔다. 같은 농도로 두면 테가 앞으로 나와 읽는 것을 방해한다
 */
function RingBackdrop({ variant }: {variant: 'flow' | 'bound';}) {
  const id = `ring-${variant}`;
  const flow = variant === 'flow';
  /** 테 위에 찍는 점. flow 는 세 단계를 궤도에 올리고, bound 는 넘지 않는 선만 남긴다 */
  const nodes = flow ?
  [
  { angle: -118, r: 34, fill: '#12B76A' },
  { angle: -34, r: 34, fill: '#F7A51B' },
  { angle: 48, r: 34, fill: '#FF5A5A' }] :
  [];

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <svg
        viewBox="0 0 100 100"
        className="absolute left-1/2 top-1/2 aspect-square w-[92%] -translate-x-1/2 -translate-y-1/2 lg:left-[66%] lg:h-[98%] lg:w-auto">

        <defs>
          {/* 테만 있으면 선 세 줄로 보인다. 가운데를 아주 옅게 밝혀 판이 비어 보이지 않게 한다 */}
          <radialGradient id={`${id}-glow`}>
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.09" />
            <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.035" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="50" cy="50" r="50" fill={`url(#${id}-glow)`} />

        {/*
          바깥 테는 장면마다 다르다. 「하지 않는 일」은 끊어진 선으로 둔다 —
          넘지 않는 경계를 그대로 그린 것이고, 안쪽을 비워 두면 뜻이 더 분명해진다
        */}
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={flow ? 0.16 : 0.22}
          strokeWidth="0.4"
          strokeDasharray={flow ? undefined : '2.4 2.2'} />

        <circle cx="50" cy="50" r="34" fill="none" stroke="#FFFFFF" strokeOpacity="0.13" strokeWidth="0.4" />
        {flow &&
        <circle cx="50" cy="50" r="19" fill="none" stroke="#FFFFFF" strokeOpacity="0.1" strokeWidth="0.4" />
        }

        {/*
          점이 테를 따라 천천히 돈다 (#247 리뷰). 1번 장면(OrbitStage)이 쓰는 orbit(52초)과
          같은 속도라 두 장면이 따로 놀지 않는다. 그룹째 돌리므로 점 사이 간격은 그대로다.
          motion-safe 라 「동작 줄이기」를 켠 사람에게는 멈춰 있다
        */}
        <g
          className="motion-safe:animate-orbit"
          style={{ transformBox: 'view-box', transformOrigin: '50% 50%' }}>

          {nodes.map((node) => {
            const rad = node.angle * Math.PI / 180;
            return (
              <circle
                key={node.angle}
                cx={50 + node.r * Math.cos(rad)}
                cy={50 + node.r * Math.sin(rad)}
                r="1.7"
                fill={node.fill}
                fillOpacity="0.85" />);

          })}
        </g>
      </svg>
    </div>);

}

/** 칸 높이를 셋이 같게 맞춘다. 글 쓰는 칸은 svg 가 아니라 이쪽을 쓴다 */
/** 판정 흐름. 칸마다 그 단계를 그린다 — 조각은 랜딩의 01·02·03 카드와 같이 쓴다 */
function FlowFigure() {
  return (
    <FigureGrid>
      <UploadRows />
      <InterviewCard />
      <VerdictCard />
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

      {/*
        2. 세액 확정 제시 — 계산기. 앞의 그림(줄 아래 굵은 금액)은 무슨 뜻인지 안 읽혔다 (#238 리뷰).
        세액을 계산해 답을 내놓는 도구라 글자 없이도 읽힌다
      */}
      <FigureCell>
        <Forbidden>
          <rect x="36" y="26" width="44" height="64" rx="8" fill="#FFFFFF" fillOpacity="0.6" />
          {/* 표시창 */}
          <rect x="43" y="33" width="30" height="13" rx="3" fill="#152F56" fillOpacity="0.55" />
          {/* 버튼 여섯 개 */}
          {[54, 67, 80].map((y) =>
          [45, 56, 67].map((x) =>
          <rect key={`${x}-${y}`} x={x} y={y} width="7" height="7" rx="2" fill="#152F56" fillOpacity="0.45" />
          )
          )}
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
  figure,
  backdrop




}: {eyebrow: string; title: string; items: string[]; figure: React.ReactNode; backdrop: 'flow' | 'bound';}) {
  return (
    <div className="absolute inset-0 flex flex-col px-8 pt-12 sm:px-16 sm:pt-16">
      <RingBackdrop variant={backdrop} />
      {/* 밝은 파랑 판 위에서 핑크는 대비 1.60 이라 안 읽힌다. eyebrow 는 흰색으로 둔다 */}
      <p className="relative text-body text-white">{eyebrow}</p>
      <strong className="mt-5 block whitespace-pre-line relative text-h2 font-normal leading-tight tracking-ir text-white [word-break:keep-all] lg:text-ir-display">
        {title}
      </strong>
      {/* 도식은 제목과 항목 사이 빈 자리를 채운다. 좁은 화면에서는 자리가 없어 숨는다 */}
      <div className="relative flex min-h-0 flex-1 items-center sm:py-8">{figure}</div>
      {/* 좁은 화면은 1 / 3 알약이 항목 줄 바로 아래(bottom-24)에 떠 있다. 항목 사이를 좁히고 알약 높이만큼 더 띄운다 */}
      <ul className="relative grid gap-3 pb-36 sm:grid-cols-3 sm:gap-6 sm:pb-24">
        {items.map((item) =>
        <li key={item} className="border-t border-white/20 pt-3 sm:pt-5">
            <strong className="block text-h4 font-bold leading-tight tracking-ir-sm text-white [word-break:keep-all]">
              {item}
            </strong>
          </li>
        )}
      </ul>
    </div>);

}

/** autoplay: 저절로 넘길지. 랜딩은 인트로가 덮는 동안 끈다 — 걷혔을 때 1번 장면부터 보이게 */
export function HeroBanner({ autoplay = true }: {autoplay?: boolean;}) {
  const track = useRef<HTMLUListElement>(null);
  const [page, setPage] = useState(0);
  const wrap = useRef<Wrap | null>(null);
  /** 마지막으로 잰 칸 너비. 창이 바뀌었을 때 「바뀌기 전 기준으로」 몇 번째였는지 세는 데 쓴다 */
  const width = useRef(0);
  /** ⏸ 로 멈췄는지 */
  const [stopped, setStopped] = useState(false);
  /** 마우스가 올라가 있거나 키보드 포커스가 안에 있다. 읽거나 누르는 동안은 넘기지 않는다 */
  const [holding, setHolding] = useState(false);
  const playing = autoplay && !stopped && !holding;

  /** 옮겨 붙였던 장면을 제자리로 돌린다. 보이던 장면이 그대로 보이게 스크롤을 같이 맞춘다 */
  const unwrap = useCallback(() => {
    const el = track.current;
    if (!el || !wrap.current) return;
    const at = pageOf(el, wrap.current);
    wrap.current.slide.style.order = '';
    wrap.current = null;
    el.scrollLeft = at * el.clientWidth;
    setPage(at);
  }, []);

  /**
   * 끝에서 한 번 더 가면 반대쪽 끝으로 돈다 (#238 리뷰). 3 다음은 1 이다.
   * 그냥 끌면 중간 장면을 거꾸로 훑고 지나가 되감기처럼 보인다. 그래서 갈 장면을 지금 장면
   * 옆으로 잠깐 옮겨 붙이고(CSS order) 한 칸만 미끄러진 뒤, 도착하면 onScroll 이 제자리로 돌린다.
   * 장면을 복제하지 않으니 h1 이 둘이 되지 않는다
   */
  const move = useCallback((direction: -1 | 1) => {
    const el = track.current;
    if (!el) return;
    // 손으로 끌다 만 돌기가 남아 있으면 먼저 정리한다
    unwrap();
    const width = el.clientWidth;
    const raw = Math.round(el.scrollLeft / width) + direction;
    const next = (raw + SLIDE_COUNT) % SLIDE_COUNT;
    if (raw === next || reducedMotion()) {
      el.scrollTo({ left: next * width, behavior: reducedMotion() ? 'auto' : 'smooth' });
      return;
    }
    const slide = el.children[next] as HTMLElement;
    slide.style.order = String(direction);
    wrap.current = { slide, step: direction };
    // 옮겨 붙이면 지금 장면이 한 칸 밀린다. 같은 장면이 보이도록 스크롤을 먼저 옮긴다
    el.scrollLeft = (direction === 1 ? SLIDE_COUNT - 2 : 1) * width;
    el.scrollTo({ left: (direction === 1 ? SLIDE_COUNT - 1 : 0) * width, behavior: 'smooth' });
  }, [unwrap]);

  /**
   * 칸 너비가 바뀌어도 `scrollLeft` 는 px 이라 그대로 남는다. 끝을 넘어 도는 중(order 로
   * 옮겨 붙인 상태)에 바뀌면 되돌릴 기준이 어긋나, 장면 사이에 18px 걸쳐 멈추고 옮겨 붙인
   * 장면이 제자리로 돌아오지 않는다. 바뀌기 전 너비로 몇 번째였는지 세고 새 너비에 맞춘다.
   *
   * `resize` 가 아니라 `ResizeObserver` 다. 폭은 창 크기 말고도 바뀌고(스크롤바가 생기거나
   * 브라우저를 확대할 때) 그때는 `resize` 가 오지 않는다
   */
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    width.current = el.clientWidth;
    const observer = new ResizeObserver(() => {
      const was = width.current;
      const now = el.clientWidth;
      if (!now || now === was) return;
      width.current = now;
      const raw = was ? Math.round(el.scrollLeft / was) : 0;
      // 도는 중이면 옮겨 붙인 만큼 되돌려 센 뒤 제자리로 돌린다
      const at = wrap.current ? (raw + wrap.current.step + SLIDE_COUNT) % SLIDE_COUNT : raw;
      if (wrap.current) {
        wrap.current.slide.style.order = '';
        wrap.current = null;
      }
      el.scrollLeft = at * now;
      setPage(at);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 움직임을 줄이라는 설정이면 멈춘 채로 시작한다. ▶ 로 켤 수는 있다.
  // 첫 렌더가 아니라 effect 에서 읽는다 — 빌드 때 미리 그리는 HTML 에는 window 가 없다
  useEffect(() => {
    if (reducedMotion()) setStopped(true);
  }, []);

  // 장면이 바뀔 때마다(손으로 넘겨도) 간격을 새로 센다
  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => move(1), AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [playing, page, move]);

  return (
    <div
      // 멈춤은 장면 넘김만이 아니라 궤도 회전도 멈춘다. 움직이는 것이 남아 있으면 멈춘 것이 아니다(WCAG 2.2.2)
      className={`relative ${stopped ? '[&_*]:[animation-play-state:paused]' : ''}`}
      onPointerEnter={(e) => {
        // 터치는 손을 떼도 hover 가 남는다. 마우스만 본다
        if (e.pointerType === 'mouse') setHolding(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') setHolding(false);
      }}
      onFocus={(e) => {
        // 마우스로 누른 버튼에 남는 포커스까지 잡으면 손을 치운 뒤에도 계속 멈춰 있다. 키보드 포커스만 본다
        if (e.target.matches(':focus-visible')) setHolding(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHolding(false);
      }}>
      <ul
        ref={track}
        data-hero-panel
        onScroll={() => {
          const el = track.current;
          if (!el) return;
          const w = wrap.current;
          // 돌아서 도착했으면 옮겨 붙인 장면을 제자리로
          if (w && Math.abs(el.scrollLeft - (w.step === 1 ? SLIDE_COUNT - 1 : 0) * el.clientWidth) < 2) {
            unwrap();
            return;
          }
          setPage(pageOf(el, w));
        }}
        className="flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-[20px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

        <Slide>
          <OrbitStage paused={stopped} />
          {/* 글은 궤도 위에 올린다 */}
          <div className="relative z-10 px-8 pt-12 sm:px-16 sm:pt-16">
            <p className="text-body text-white">
              1인 IT 개발 사업자를 위한 경비 판정
            </p>
            {/* 페이지의 h1. 프리렌더가 공개 페이지마다 h1 이 하나인지 본다(scripts/prerender.mjs) */}
            <h1 className="mt-5 block text-h2 font-normal leading-tight tracking-ir text-white [word-break:keep-all] lg:text-h2-lg xl:text-ir-display">
              이 카드값이 경비인지,
              <br />
              조문까지 붙여 답합니다
            </h1>
          </div>
        </Slide>

        <Slide>
          <TextSlide
            eyebrow="판정 흐름"
            title={'카드내역 한 번에\n건별 판정까지'}
            items={FLOW_STEPS.slice(0, 3).map((step) => step.title)}
            figure={<FlowFigure />}
            backdrop="flow" />

        </Slide>

        <Slide>
          <TextSlide
            eyebrow="하지 않는 일"
            title={'할 수 있는 것보다\n하지 않는 것을 먼저'}
            items={NOT_DOING.map((item) => item.title)}
            figure={<NotDoingFigure />}
            backdrop="bound" />

        </Slide>
      </ul>

      {/*
        오른쪽 아래 현재/전체. 왼쪽 아래는 「바로가기」가 베어 낸 자리라,
        좁은 화면에서는 그 띠(72px)를 피해 위로 올린다
      */}
      {/*
        띠를 흰색이 아니라 검정으로 깐다. 흰 띠(bg-white/10)는 판보다 밝아져서
        13px 흰 글자가 대비 4.08 로 떨어진다 — 검정 10% 면 5.76 이다
      */}
      <div className="absolute bottom-24 right-6 z-20 flex items-center gap-1 rounded-full bg-black/10 px-2 py-1 text-small text-white sm:bottom-8 sm:right-8">
        {/* 저절로 넘어가는 동안 읽으면 4초마다 끼어든다. 멈췄을 때만 읽는다 */}
        <span className="pl-1.5 pr-1 tabular-nums" aria-live={playing ? 'off' : 'polite'}>
          {page + 1} / {SLIDE_COUNT}
        </span>
        <button
          type="button"
          aria-label="이전 장면"
          onClick={() => move(-1)}
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/15">

          <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={stopped ? '자동 넘김 켜기' : '자동 넘김 멈추기'}
          onClick={() => setStopped((value) => !value)}
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/15">

          {stopped ?
          <PlayIcon className="h-4 w-4" aria-hidden="true" /> :
          <PauseIcon className="h-4 w-4" aria-hidden="true" />}
        </button>
        <button
          type="button"
          aria-label="다음 장면"
          onClick={() => move(1)}
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/15">

          <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>);

}
