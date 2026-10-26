import React, { useEffect, useState } from 'react';

/**
 * 첫 화면 큰 판. 동심원 위를 그림이 돌고 가운데 문구가 바뀐다.
 * 바깥 테가 돌면 그림은 반대 방향으로 같은 주기로 돌아 늘 똑바로 서 있다.
 *
 * 문구를 바꾸려면 아래 CENTER_LINES 만 고치면 된다.
 */
const CENTER_LINES = [
'규칙 엔진이 판정합니다',
'조문 번호가 함께 나옵니다',
'애매하면 되묻습니다'];


const SWAP_MS = 3200;

/** 궤도 위 자리. angle 은 12시부터 시계방향, radius 는 판 절반 대비 % */
type Spot = {angle: number; radius: number; size: number; Icon: () => React.ReactElement;};

/* 노란 판 위에서 읽히게 흰 바탕 + 검정 선으로 그리고, 주황·빨강만 점으로 쓴다 */
const Card = () =>
<svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <rect x="6" y="14" width="52" height="36" rx="7" fill="#FFFFFF" stroke="#0A0A0A" strokeWidth="2.5" />
    <rect x="6" y="23" width="52" height="7" fill="#0A0A0A" />
    <rect x="13" y="38" width="16" height="4" rx="2" fill="#FF6A00" />
  </svg>;


const Receipt = () =>
<svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <path
    d="M13 8h38v44l-5.4-4-5.4 4-5.4-4-5.4 4-5.4-4-5.4 4-5.6-4z"
    fill="#FFFFFF"
    stroke="#0A0A0A"
    strokeWidth="2.5"
    strokeLinejoin="round" />

    <rect x="21" y="20" width="22" height="3.4" rx="1.7" fill="#0A0A0A" />
    <rect x="21" y="29" width="22" height="3.4" rx="1.7" fill="#C9CDD2" />
    <rect x="21" y="38" width="13" height="3.4" rx="1.7" fill="#C9CDD2" />
  </svg>;


const Store = () =>
<svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <rect x="12" y="27" width="40" height="26" rx="4" fill="#FFFFFF" stroke="#0A0A0A" strokeWidth="2.5" />
    <path d="M10 14h44l-4 13H14z" fill="#FF4B4B" />
    <rect x="28" y="37" width="8" height="16" rx="2" fill="#0A0A0A" />
  </svg>;


const Bubble = () =>
<svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <path
    d="M32 13c12.7 0 23 7.6 23 17s-10.3 17-23 17a30 30 0 0 1-5.6-.5l-10.6 5.3 3-8.6C12.4 40 9 35 9 30c0-9.4 10.3-17 23-17z"
    fill="#FF6A00" />

    <circle cx="23" cy="30" r="3" fill="#FFFFFF" />
    <circle cx="32" cy="30" r="3" fill="#FFFFFF" />
    <circle cx="41" cy="30" r="3" fill="#FFFFFF" />
  </svg>;


const Statute = () =>
<svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <rect x="12" y="8" width="40" height="48" rx="5" fill="#FFFFFF" stroke="#0A0A0A" strokeWidth="2.5" />
    <rect x="20" y="19" width="24" height="3.4" rx="1.7" fill="#0A0A0A" />
    <rect x="20" y="28" width="24" height="3.4" rx="1.7" fill="#C9CDD2" />
    <rect x="20" y="37" width="16" height="3.4" rx="1.7" fill="#C9CDD2" />
    <circle cx="44" cy="46" r="6" fill="#FF4B4B" stroke="#0A0A0A" strokeWidth="2" />
  </svg>;


/** 바깥 테 — 시계방향 */
const OUTER: Spot[] = [
{ angle: 40, radius: 44, size: 76, Icon: Store },
{ angle: 150, radius: 44, size: 72, Icon: Bubble },
{ angle: 258, radius: 44, size: 66, Icon: Receipt }];


/** 안쪽 테 — 반시계방향 */
const INNER: Spot[] = [
{ angle: 108, radius: 34, size: 62, Icon: Card },
{ angle: 300, radius: 34, size: 56, Icon: Statute }];


function Ring({
  spots,
  spin,
  counter




}: {spots: Spot[];spin: string;counter: string;}) {
  return (
    <div className={`absolute inset-0 ${spin} motion-reduce:animate-none`}>
      {spots.map((spot) => {
        const rad = (spot.angle - 90) * Math.PI / 180;
        return (
          <span
            key={spot.angle}
            className="absolute"
            style={{
              left: `${50 + spot.radius * Math.cos(rad)}%`,
              top: `${50 + spot.radius * Math.sin(rad)}%`,
              width: spot.size,
              height: spot.size,
              marginLeft: -spot.size / 2,
              marginTop: -spot.size / 2
            }}>

            <span
              className={`block h-full w-full ${counter} motion-reduce:animate-none`}>

              <spot.Icon />
            </span>
          </span>);

      })}
    </div>);

}

export function OrbitStage() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (reduce) return;
    const timer = window.setInterval(
      () => setIndex((n) => (n + 1) % CENTER_LINES.length),
      SWAP_MS
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* 좁은 화면에서는 테만 남긴다 */}
      <span className="absolute left-[72%] top-[62%] aspect-square w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink/[0.07] lg:hidden" />
      <span className="absolute left-[72%] top-[62%] aspect-square w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink/[0.07] lg:hidden" />
      {/*
        궤도는 정사각 판 안에서만 돈다. 가로·세로 %를 따로 쓰면 원이 아니라
        타원이 되어 그림이 좌우 끝으로 밀린다. 중심을 오른쪽으로 비켜 두어
        왼쪽 위 제목과 겹치지 않게 한다
      */}
      <div className="absolute left-[66%] top-1/2 hidden aspect-square h-[94%] -translate-x-1/2 -translate-y-1/2 lg:block">
        <span className="absolute left-1/2 top-1/2 aspect-square w-[104%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink/[0.07]" />
        <span className="absolute left-1/2 top-1/2 aspect-square w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink/[0.07]" />

        <Ring spots={OUTER} spin="animate-orbit" counter="animate-orbit-back" />
        <Ring
          spots={INNER}
          spin="animate-orbit-slow"
          counter="animate-orbit-slow-back" />

      </div>

      {/* 가운데 바뀌는 문구 — 궤도 중심에 맞춘다 */}
      <div className="absolute inset-y-0 left-[66%] hidden w-[70%] -translate-x-1/2 items-center justify-center px-8 lg:flex">
        <p className="relative text-center text-h3 font-bold tracking-ir-sm text-ink lg:text-ir-panel">
          {CENTER_LINES.map((line, i) =>
          <span
            key={line}
            className={`block transition-opacity duration-700 ${
            i === index ? 'opacity-100' : 'absolute inset-0 opacity-0'}`
            }>

              {line}
            </span>
          )}
        </p>
      </div>
    </div>);

}
