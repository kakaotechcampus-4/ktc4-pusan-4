import { useEffect, useState } from 'react';
import { OrbitStage } from './OrbitStage';

/**
 * 메인에 들어가기 전에 한 번 덮는 전면 화면. 궤도가 그려지는 동안 제목을 보여주고 스스로 걷힌다.
 *
 * 주소를 나누지 않고 메인 위에 덮는다 — 주소를 나누면 걷을 때 메인을 처음부터 다시 그려서
 * 흰 화면이 한 번 번쩍인다. 덮어 두면 뒤에 메인이 이미 그려져 있어 그대로 드러나기만 한다.
 */

/** 모션(1300ms)이 끝나고 잠깐 머문 뒤 걷기 시작한다 */
const HOLD_MS = 2000;

/** 걷히는 시간. 아래 duration-500 과 같아야 한다 */
const FADE_MS = 500;

/** onDone: 다 걷혔다. Landing 이 이때 화면에서 지운다 */
export function IntroOverlay({ onDone }: {onDone: () => void;}) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setLeaving(true), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onDone, FADE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, onDone]);

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
      className={`fixed inset-0 z-50 overflow-hidden bg-surface2 transition-opacity duration-500 ${
      leaving ? 'pointer-events-none opacity-0' : 'opacity-100'}`
      }>

      <OrbitStage intro full />

      <button
        type="button"
        onClick={() => setLeaving(true)}
        className="absolute right-6 top-6 z-20 rounded-full border border-white/20 px-4 py-1.5 text-small text-white/70 transition-colors hover:border-white/40 hover:text-white sm:right-8 sm:top-8">

        건너뛰기
      </button>

      {/* 글은 궤도 위에 올린다. 첫 모션에서 제일 먼저 올라온다 */}
      <div className="relative z-10 px-8 pt-20 animate-rise motion-reduce:animate-none sm:px-16 sm:pt-24">
        <p className="text-body text-highlight">
          1인 IT 개발 사업자를 위한 경비 판정
        </p>
        <strong className="mt-5 block text-h2 font-normal leading-tight tracking-ir text-white [word-break:keep-all] lg:text-ir-display">
          이 카드값이 경비인지,
          <br />
          조문까지 붙여 답합니다
        </strong>
      </div>
    </div>);

}
