import { useEffect, useState } from 'react';
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
 * 걷힐 때 파란 판이 메인 배너 자리로 줄어든다. 줄어드는 시간과 다 줄어든 뒤 사라지는 시간.
 * 아래 duration-700, duration-200 과 같아야 한다
 */
const SHRINK_MS = 700;
const FADE_MS = 200;

/** 줄어들 자리. 메인 배너(HeroBanner)의 판이다. 못 찾으면 그냥 흐려진다 */
function heroInset() {
  const hero = document.querySelector('[data-hero-panel]');
  if (!hero) return null;
  const r = hero.getBoundingClientRect();
  const right = window.innerWidth - r.right;
  const bottom = window.innerHeight - r.bottom;
  return `inset(${r.top}px ${right}px ${bottom}px ${r.left}px round 20px)`;
}

/** onDone: 다 걷혔다. Landing 이 이때 화면에서 지운다 */
export function IntroOverlay({ onDone }: {onDone: () => void;}) {
  /** shrink: 배너 자리로 줄어드는 중. fade: 다 줄어 배너 위에 겹쳐 있다가 사라지는 중 */
  const [phase, setPhase] = useState<'show' | 'shrink' | 'fade'>('show');
  const [clip, setClip] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setPhase('shrink'), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase === 'show') return;
    if (phase === 'shrink') {
      const target = heroInset();
      // 자리를 못 찾으면 줄이지 않고 바로 흐린다
      if (target === null) {
        setPhase('fade');
        return;
      }
      setClip(target);
      const timer = window.setTimeout(() => setPhase('fade'), SHRINK_MS);
      return () => window.clearTimeout(timer);
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

  return (
    <div
      style={{ clipPath: clip ?? 'inset(0px 0px 0px 0px round 0px)' }}
      className={`fixed inset-0 z-50 overflow-hidden bg-surface2 transition-[clip-path,opacity] ease-snap ${
      phase === 'fade' ? 'pointer-events-none opacity-0 duration-200' : 'opacity-100 duration-700'}`
      }>

      {/* 판이 줄어드는 동안 안의 궤도와 글은 먼저 걷는다. 배너에는 배너의 그림이 따로 있다 */}
      <div className={`absolute inset-0 transition-opacity duration-300 ${phase === 'show' ? 'opacity-100' : 'opacity-0'}`}>
        <OrbitStage intro full />

        <button
          type="button"
          onClick={() => setPhase('shrink')}
          className="absolute right-6 top-6 z-20 rounded-full border border-white/20 px-4 py-1.5 text-small text-white transition-colors hover:border-white/40 hover:text-white sm:right-8 sm:top-8">

          건너뛰기
        </button>

        {/* 글은 궤도 위에 올린다. 첫 모션에서 제일 먼저 올라온다 */}
        <div className="relative z-10 px-8 pt-20 animate-rise motion-reduce:animate-none sm:px-16 sm:pt-24">
          <p className="text-body text-white">
            1인 IT 개발 사업자를 위한 경비 판정
          </p>
          <strong className="mt-5 block text-h2 font-normal leading-tight tracking-ir text-white [word-break:keep-all] lg:text-ir-display">
            이 카드값이 경비인지,
            <br />
            조문까지 붙여 답합니다
          </strong>
        </div>
      </div>
    </div>);

}
