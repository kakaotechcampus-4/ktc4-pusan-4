import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { OrbitStage } from './OrbitStage';

/**
 * 메인에 들어가기 전에 한 번 덮는 전면 화면. 궤도가 그려지는 동안 제목을 보여주고 스스로 걷힌다.
 *
 * 주소를 나누지 않고 메인 위에 덮는다 — 주소를 나누면 걷을 때 메인을 처음부터 다시 그려서
 * 흰 화면이 한 번 번쩍인다. 덮어 두면 뒤에 메인이 이미 그려져 있어 그대로 드러나기만 한다.
 */

/**
 * 모션(마지막 조각이 1200ms 에 끝난다)이 끝나고 머문 뒤 걷기 시작한다.
 * 2000 이면 완성된 화면이 0.8초만 보여 다 그려지자마자 사라진다 — 읽을 시간을 준다
 */
const HOLD_MS = 3500;

/**
 * 걷힐 때 파란 판이 메인 배너 자리로 줄어들고 안의 글은 배너의 같은 글 자리로 간다. 줄어드는 시간과
 * 다 줄어든 뒤 사라지는 시간. 아래 duration-700, duration-200 과 같아야 한다
 */
const SHRINK_MS = 700;
const FADE_MS = 200;

type Box = {top: number;left: number;width: number;height: number;};

const rectOf = (el: Element): Box => {
  const { top, left, width, height } = el.getBoundingClientRect();
  return { top, left, width, height };
};

/**
 * 판과 같이 옮길 글. 배너 첫 장면에 같은 글이 있다. 판을 줄이는 동안 글은 줄이지 않고
 * 배너의 같은 글 자리로 옮긴다 — 판 높이 비율로 통째로 줄이면 글이 배너 글보다 훨씬 작아져서,
 * 다 줄고 걷히는 순간 글이 커지며 튄다
 */
const TEXTS = ['eyebrow', 'title'] as const;
type Text = (typeof TEXTS)[number];

/** 글이 갈 자리. 판 왼쪽 위에서 얼마나 떨어졌는지, 글줄 폭, 글자 크기 */
type Spot = {top: number;left: number;width: number;size: number;};

const fontSizeOf = (el: Element) => parseFloat(getComputedStyle(el).fontSize);

const spotOf = (el: Element, panel: Box): Spot => {
  const box = rectOf(el);
  return { top: box.top - panel.top, left: box.left - panel.left, width: box.width, size: fontSizeOf(el) };
};

/**
 * 전면 화면 안에서 글이 transform 없이 있는 자리. offsetTop, offsetLeft 는 transform 을 보지 않아
 * 줄어드는 중에 다시 재도 처음 자리가 나온다. 전면 화면은 fixed 라 거기서 offsetParent 가 끝난다
 */
const restOf = (el: HTMLElement) => {
  let top = 0;
  let left = 0;
  for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) {
    top += node.offsetTop;
    left += node.offsetLeft;
  }
  return { top, left, size: fontSizeOf(el) };
};

/** 줄어들 자리. 메인 배너(HeroBanner)의 판과 그 안의 글이다. 못 찾으면 그냥 흐려진다 */
function heroTarget(): {box: Box;spots: Record<Text, Spot>;} | null {
  const hero = document.querySelector('[data-hero-panel]');
  const eyebrow = document.querySelector('[data-hero-eyebrow]');
  const title = document.querySelector('[data-hero-title]');
  if (!hero || !eyebrow || !title) return null;
  const box = rectOf(hero);
  return { box, spots: { eyebrow: spotOf(eyebrow, box), title: spotOf(title, box) } };
}

/** 보이는 중일 때만 걷기 시작한다 */
const leave = (phase: 'show' | 'shrink' | 'fade') => phase === 'show' ? 'shrink' : phase;

/**
 * 걷힐 때 움직이는 것은 모두 transform 과 opacity 만 바꾼다. 판의 top, left, width, height 를 바꾸면
 * 매 프레임 판 전체(궤도 포함)를 다시 그려서 중간에 끊긴다. transform 은 그려 둔 판을 그대로 옮긴다
 */
type Moves = {panel: React.CSSProperties;orbit: string;texts: Partial<Record<Text, string>>;};

/** onDone: 다 걷혔다. Landing 이 이때 화면에서 지운다 */
export function IntroOverlay({ onDone }: {onDone: () => void;}) {
  /** shrink: 배너 자리로 줄어드는 중. fade: 다 줄어 배너 위에 겹쳐 있다가 사라지는 중 */
  const [phase, setPhase] = useState<'show' | 'shrink' | 'fade'>('show');
  /** 줄이기 시작할 때의 화면 크기. 판과 안은 이 크기로 그린 채 옮긴다 */
  const [view, setView] = useState<{width: number;height: number;} | null>(null);
  const [moves, setMoves] = useState<Moves | null>(null);
  const texts = useRef<Partial<Record<Text, HTMLElement | null>>>({});

  /**
   * 글줄 폭을 배너 글과 같게 해서 같은 자리에서 줄을 바꾸게 한다. 좁은 화면에서 전면 글은 두 줄, 배너 글은 네 줄이라
   * 줄어들 때 폭을 맞추면 그 순간 줄이 바뀌며 튄다. 처음 그릴 때부터 맞춰 두고, 창 크기가 바뀌면 다시 맞춘다
   */
  const fit = (target: ReturnType<typeof heroTarget>) => {
    if (target === null) return;
    for (const key of TEXTS) {
      const el = texts.current[key];
      if (el) el.style.width = `${target.spots[key].width / (target.spots[key].size / fontSizeOf(el))}px`;
    }
  };
  useLayoutEffect(() => {
    const refit = () => fit(heroTarget());
    refit();
    window.addEventListener('resize', refit);
    return () => window.removeEventListener('resize', refit);
  }, []);

  useEffect(() => {
    // 건너뛰기로 이미 걷는 중이면 되돌리지 않는다. 앞으로만 간다
    const timer = window.setTimeout(() => setPhase(leave), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase === 'show') return;
    if (phase === 'shrink') {
      const size = { width: window.innerWidth, height: window.innerHeight };
      const aim = () => {
        const target = heroTarget();
        if (target === null) return false;
        const { box } = target;
        // 폭을 먼저 맞추고 나서 자리를 잰다(윗글 줄 수가 바뀌면 아랫글 자리도 바뀐다).
        // 창 크기가 바뀌면 글자 크기와 여백도 바뀌므로 겨눌 때마다 새로 잰다
        fit(target);
        const sx = box.width / size.width;
        const sy = box.height / size.height;
        const next: Moves = {
          panel: {
            transform: `translate(${box.left}px, ${box.top}px) scale(${sx}, ${sy})`,
            // 판을 가로세로 다르게 줄이므로 모서리도 거꾸로 늘려 둔다. 다 줄면 20px 둥근 모서리가 된다
            borderRadius: `${20 / sx}px / ${20 / sy}px`
          },
          // 궤도는 찌그러지지 않게 한 비율로 줄인다. 작은 쪽 비율이라 판 밖으로 나가지 않는다
          orbit: `translate(${box.left}px, ${box.top}px) scale(${Math.min(sx, sy)})`,
          texts: {}
        };
        for (const key of TEXTS) {
          const el = texts.current[key];
          if (!el) continue;
          const a = restOf(el);
          const b = target.spots[key];
          next.texts[key] = `translate(${box.left + b.left - a.left}px, ${box.top + b.top - a.top}px) scale(${b.size / a.size})`;
        }
        setMoves(next);
        return true;
      };
      // 자리를 못 찾으면 줄이지 않고 바로 흐린다
      if (!aim()) {
        setPhase('fade');
        return;
      }
      setView(size);
      let timer = window.setTimeout(() => setPhase('fade'), SHRINK_MS);
      // 줄어드는 동안 창 크기가 바뀌면 배너 자리도 바뀐다. 새 자리로 다시 겨누고, 새로 시작한
      // 전환이 끝날 때까지 기다린다
      const retarget = () => {
        aim();
        window.clearTimeout(timer);
        timer = window.setTimeout(() => setPhase('fade'), SHRINK_MS);
      };
      window.addEventListener('resize', retarget);
      return () => {
        window.removeEventListener('resize', retarget);
        window.clearTimeout(timer);
      };
    }
    const timer = window.setTimeout(onDone, FADE_MS);
    return () => window.clearTimeout(timer);
  }, [phase, onDone]);

  /*
   * 덮고 있는 동안 뒤의 메인이 스크롤되면, 걷혔을 때 중간 어디쯤에 가 있다.
   * 전면 화면은 fixed 라 손가락·휠이 뒤로 그대로 넘어간다
   */
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = before;
    };
  }, []);

  /** 판, 궤도, 글이 같은 시간, 같은 곡선으로 움직여야 글이 판에 붙어 간다 */
  const layer = 'absolute left-0 top-0 h-full w-full origin-top-left will-change-transform duration-700 ease-snap';
  const textMotion = 'origin-top-left will-change-transform transition-transform duration-700 ease-snap';

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-200 ease-snap ${
      phase === 'fade' ? 'pointer-events-none opacity-0' : ''}`
      }>

      {/* 파란 판. 배너 자리로 줄어든다 */}
      <div className={`${layer} bg-surface2 transition-transform`} style={{ ...view, ...moves?.panel }} />

      {/*
        궤도는 판과 같이 줄면서 흐려진다. 배너 궤도는 그림 배치가 달라 맞출 수 없다.
        다 줄면 판째 흐려지며 같은 자리의 배너가 드러난다
      */}
      <div
        className={`${layer} transition-[transform,opacity] ${phase === 'show' ? '' : 'opacity-0'}`}
        style={{ ...view, transform: moves?.orbit }}>
        <div className="absolute inset-0 overflow-hidden">
          <OrbitStage intro full />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setPhase(leave)}
        className={`absolute right-6 top-6 z-20 rounded-full border border-white/20 px-4 py-1.5 text-small text-white transition-colors hover:border-white/40 hover:text-white sm:right-8 sm:top-8 ${phase === 'show' ? '' : 'invisible'}`}>

        건너뛰기
      </button>

      {/* 글은 궤도 위에 올린다. 첫 모션에서 제일 먼저 올라온다. 걷힐 때는 배너의 같은 글 자리로 간다 */}
      <div className="relative z-10 px-8 pt-20 animate-rise motion-reduce:animate-none sm:px-16 sm:pt-24">
        <p
          ref={(el) => {
            texts.current.eyebrow = el;
          }}
          style={{ transform: moves?.texts.eyebrow }}
          className={`text-body text-white ${textMotion}`}>
          1인 IT 개발 사업자를 위한 경비 판정
        </p>
        <strong
          ref={(el) => {
            texts.current.title = el;
          }}
          style={{ transform: moves?.texts.title }}
          className={`mt-5 block text-h2 font-normal leading-tight tracking-ir text-white [word-break:keep-all] lg:text-h2-lg xl:text-ir-display ${textMotion}`}>
          이 카드값이 경비인지,
          <br />
          조문까지 붙여 답합니다
        </strong>
      </div>
    </div>);

}
