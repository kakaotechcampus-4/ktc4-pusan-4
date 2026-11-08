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

/*
 * 첫 모션 조각. 순서는 제목(Landing) → 테 → 그림 → 가운데 문구다.
 * scale 을 쓰는 것은 겉면에만 둔다 — -translate-x-1/2 가 걸린 요소에 두면 transform 이
 * 덮여서 동그라미가 반 칸 밀린다
 */
const DRAW = 'animate-draw [animation-delay:250ms] motion-reduce:animate-none';
const SPREAD = 'animate-spread [animation-delay:500ms] motion-reduce:animate-none';
const CENTER_RISE = 'animate-rise [animation-delay:800ms] motion-reduce:animate-none';

/** 궤도 위 자리. angle 은 12시부터 시계방향, radius 는 판 절반 대비 % */
type Spot = {angle: number; radius: number; size: number; Icon: () => React.ReactElement;};

/*
 * 남색 판 위에 올라간다. 흰 바탕만으로 테두리가 서니 검정 외곽선은 두지 않고,
 * 안쪽 획만 먹색으로 둔다. 점으로 쓰는 색은 노랑(강조)과 상태색 막대뿐이다
 */
const Card = () =>
<svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <rect x="6" y="14" width="52" height="36" rx="7" fill="#FFFFFF" />
    <rect x="6" y="23" width="52" height="7" fill="#191F28" />
    <rect x="13" y="38" width="16" height="4" rx="2" fill="#FF5C9A" />
  </svg>;


const Receipt = () =>
<svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <path
    d="M13 8h38v44l-5.4-4-5.4 4-5.4-4-5.4 4-5.4-4-5.4 4-5.6-4z"
    fill="#FFFFFF"
    />

    <rect x="21" y="20" width="22" height="3.4" rx="1.7" fill="#191F28" />
    <rect x="21" y="29" width="22" height="3.4" rx="1.7" fill="#DCE1E8" />
    <rect x="21" y="38" width="13" height="3.4" rx="1.7" fill="#DCE1E8" />
  </svg>;


const Store = () =>
<svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <rect x="12" y="27" width="40" height="26" rx="4" fill="#FFFFFF" />
    <path d="M10 14h44l-4 13H14z" fill="#FF5A5A" />
    <rect x="28" y="37" width="8" height="16" rx="2" fill="#191F28" />
  </svg>;


const Bubble = () =>
<svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <path
    d="M32 13c12.7 0 23 7.6 23 17s-10.3 17-23 17a30 30 0 0 1-5.6-.5l-10.6 5.3 3-8.6C12.4 40 9 35 9 30c0-9.4 10.3-17 23-17z"
    fill="#FF5C9A" />

    <circle cx="23" cy="30" r="3" fill="#2C6AE8" />
    <circle cx="32" cy="30" r="3" fill="#2C6AE8" />
    <circle cx="41" cy="30" r="3" fill="#2C6AE8" />
  </svg>;


const Statute = () =>
<svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <rect x="12" y="8" width="40" height="48" rx="5" fill="#FFFFFF" />
    <rect x="20" y="19" width="24" height="3.4" rx="1.7" fill="#191F28" />
    <rect x="20" y="28" width="24" height="3.4" rx="1.7" fill="#DCE1E8" />
    <rect x="20" y="37" width="16" height="3.4" rx="1.7" fill="#DCE1E8" />
    <circle cx="44" cy="46" r="6" fill="#FF5A5A" />
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


/**
 * 좁은 화면용. 테 하나에 다섯을 고르게 올린다 — 판이 작으면 안팎 테의 반지름 차이가
 * 17px 밖에 안 되어 그림끼리 겹쳐 보인다. 크기 순서는 바깥 테를 따른다
 */
const NARROW: Spot[] = [
{ angle: 0, radius: 44, size: 76, Icon: Store },
{ angle: 72, radius: 44, size: 72, Icon: Bubble },
{ angle: 144, radius: 44, size: 66, Icon: Receipt },
{ angle: 216, radius: 44, size: 62, Icon: Card },
{ angle: 288, radius: 44, size: 56, Icon: Statute }];


/** 배너 판이 가장 클 때의 폭. fluid 그림 크기는 이 폭에 대한 비율이다 */
const BOARD_PX = 584;

/**
 * scale: 그림 크기 배수. 좁은 화면은 판이 작아 그대로 두면 그림끼리 붙는다
 * fluid: 그림 크기를 판 폭에 맞춰 줄인다. 배너 판은 1024~1279 에서 작아지는데 그림이
 *        그대로면 안팎 테의 그림끼리 겹친다
 */
function Ring({
  spots,
  spin,
  counter,
  scale = 1,
  fluid = false




}: {spots: Spot[];spin: string;counter: string;scale?: number;fluid?: boolean;}) {
  return (
    <div className={`absolute inset-0 ${spin} motion-reduce:animate-none ${fluid ? '[container-type:size]' : ''}`}>
      {spots.map((spot) => {
        const rad = (spot.angle - 90) * Math.PI / 180;
        const size = spot.size * scale;
        const radius = spot.radius;
        return (
          <span
            key={spot.angle}
            className="absolute"
            style={fluid ?
            {
              left: `${50 + radius * Math.cos(rad)}%`,
              top: `${50 + radius * Math.sin(rad)}%`,
              // 판 폭을 따라 줄되 60% 아래로는 줄이지 않는다. 더 작으면 그림이 무엇인지 안 읽힌다
              width: `clamp(${size * 0.6}px, ${size / BOARD_PX * 100}cqw, ${size}px)`,
              aspectRatio: '1',
              transform: 'translate(-50%, -50%)'
            } :
            {
              left: `${50 + radius * Math.cos(rad)}%`,
              top: `${50 + radius * Math.sin(rad)}%`,
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2
            }}>

            <span
              className={`block h-full w-full ${counter} motion-reduce:animate-none`}>

              <spot.Icon />
            </span>
          </span>);

      })}
    </div>);

}

/**
 * intro: 첫 모션 중인가. 인트로 화면에서만 켠다 — 메인 배너에서는 돌기만 한다
 * full: 전체화면인가. 좁은 화면에서도 그림을 다 띄운다 — 440px 패널에서는 테만 남기지만
 *       844px 짜리 인트로에서 테만 두면 거의 빈 화면이 된다
 * paused: 배너의 멈춤 버튼을 눌렀다. 가운데 문구도 바꾸지 않는다. 회전은 HeroBanner 가 멈춘다
 */
export function OrbitStage({ intro = false, full = false, paused = false }: {intro?: boolean; full?: boolean; paused?: boolean;}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (reduce || paused) return;
    const timer = window.setInterval(
      () => setIndex((n) => (n + 1) % CENTER_LINES.length),
      SWAP_MS
    );
    return () => window.clearInterval(timer);
  }, [paused]);

  const centerText =
  <p
    className={`relative text-center text-h3 font-bold tracking-ir-sm text-white ${
    full ? 'lg:text-ir-panel' : 'min-[1400px]:text-ir-panel'} ${intro ? CENTER_RISE : ''}`
    }>

      {CENTER_LINES.map((line, i) =>
    <span
      key={line}
      className={`block transition-opacity duration-700 ${
      i === index ? 'opacity-100' : 'absolute inset-0 opacity-0'}`
      }>

          {line}
        </span>
    )}
    </p>;


  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/*
        좁은 화면용 판. 아래 lg 판과 중심·크기가 달라 따로 둔다. 전에는 여기에 테만 두고
        그림을 껐는데, 인트로(full)에서는 그림이 다 나와서 메인으로 넘어오면 그림이
        사라진 것처럼 보였다.

        판 크기는 제목 아랫줄과 「무료로 판정해보기」 사이(170px)에 맞춘 것이다 —
        더 키우면 그림이 글자나 버튼에 걸린다. 바깥 테를 그림이 도는 자리에 바로 두어,
        그림이 테에 올라타 보이게 한다. 안쪽 테는 그림 없이 깊이만 준다
      */}
      <div
        className={`absolute left-[60%] top-[53%] aspect-square w-[37%] -translate-x-1/2 -translate-y-1/2 ${
        full ? 'hidden' : 'lg:hidden'}`
        }>
        <div className={`absolute inset-0 ${intro ? DRAW : ''}`}>
          <span className="absolute left-1/2 top-1/2 aspect-square w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
          <span className="absolute left-1/2 top-1/2 aspect-square w-[44%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
        </div>

        <div className={`absolute inset-0 ${intro ? SPREAD : ''}`}>
          <Ring spots={NARROW} spin="animate-orbit" counter="animate-orbit-back" scale={0.5} />
        </div>
      </div>
      {/*
        궤도는 정사각 판 안에서만 돈다. 가로·세로 %를 따로 쓰면 원이 아니라
        타원이 되어 그림이 좌우 끝으로 밀린다.

        배너에서는 판을 오른쪽 끝에 붙이고, 폭에서 제목 몫(lg 424px, xl 520px)을 뺀 만큼만
        키운다. 500px 에서 멈춘다. 더 크면 오른쪽 아래 그림이 1 / 3 알약 밑으로 지나간다. 전에는 중심을 66% 에 두고 판 높이에 맞춰 키워서 바깥 그림이 제목 둘째 줄
        위를 지나갔다 (C81). 1024~1279 는 자리가 좁아 제목도 한 단계 작다(HeroBanner)
      */}
      <div
        className={
        full ?
        'absolute left-1/2 top-1/2 aspect-square w-[88%] -translate-x-1/2 -translate-y-1/2 lg:left-[66%] lg:h-[94%] lg:w-auto' :
        'absolute right-8 top-1/2 hidden aspect-square -translate-y-1/2 lg:block lg:w-[min(500px,calc(100%-424px))] xl:w-[min(500px,calc(100%-520px))]'
        }>
        <div className={`absolute inset-0 ${intro ? DRAW : ''}`}>
          <span className="absolute left-1/2 top-1/2 aspect-square w-[104%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
          <span className="absolute left-1/2 top-1/2 aspect-square w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
        </div>

        {/* 회전은 Ring 이 하고 퍼지는 것은 이 겉면이 한다. 한 요소에 두면 둘 중 하나가 덮인다 */}
        <div className={`absolute inset-0 ${intro ? SPREAD : ''}`}>
          <Ring spots={OUTER} spin="animate-orbit" counter="animate-orbit-back" fluid={!full} />
          <Ring
            spots={INNER}
            spin="animate-orbit-slow"
            counter="animate-orbit-slow-back"
            fluid={!full} />

        </div>

        {/*
          배너에서는 문구를 판 안에 둔다. 판이 오른쪽에 붙어 있어 판과 함께 움직여야 중심이 맞는다.
          1280 아래는 판이 작아 문구가 안쪽 그림에 걸린다. 휴대폰처럼 그림만 둔다
        */}
        {!full &&
        <div className="absolute left-1/2 top-1/2 hidden w-[150%] -translate-x-1/2 -translate-y-1/2 justify-center xl:flex">
            {centerText}
          </div>
        }
      </div>

      {/* 가운데 바뀌는 문구. 인트로는 궤도 중심에 맞춘다 */}
      {full &&
      <div className="absolute inset-y-0 left-1/2 flex w-[80%] -translate-x-1/2 items-center justify-center px-8 lg:left-[66%] lg:w-[70%]">
          {centerText}
        </div>
      }
    </div>);

}
