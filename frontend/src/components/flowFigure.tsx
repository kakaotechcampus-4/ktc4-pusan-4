/**
 * 판정 흐름 도식 세 칸 — 올린 거래 / 문진에 답한 카드 / 실제 판정 카드.
 *
 * 히어로(파란 판)와 랜딩의 01·02·03 카드(연파랑 판)가 같은 그림을 쓴다. 두 곳이 같은 말을
 * 하는데 그림이 다르면 따로 노는 것처럼 보인다 (#247 리뷰).
 *
 * 바탕색이 달라서 색만 두 벌이다. 연파랑(#E4EDFB) 위에서 흰색은 대비 1.18 이라 안 보이고
 * accent(#2C6AE8)는 4.11 이다. 그래서 light 는 흰색 대신 파랑으로 그린다
 */
import { SymbolIcon, cn } from './ui';

export type FlowTone = 'blue' | 'light';

interface Tone {
  /** 거래 줄과 문진 막대의 색 */
  bar: string;
  /** 문진 카드 바탕 */
  card: string;
  cardOpacity: number;
  stroke: string;
  strokeOpacity: number;
  /** 거래 줄 세 단계 흐리기 */
  rows: [number, number, number];
  /** 문진 막대 — 마지막이 고른 답이라 또렷하다 */
  bars: [number, number, number];
}

const TONE: Record<FlowTone, Tone> = {
  blue: {
    bar: '#FFFFFF',
    card: '#FFFFFF',
    cardOpacity: 0.07,
    stroke: '#FFFFFF',
    strokeOpacity: 0.28,
    rows: [0.55, 0.4, 0.25],
    bars: [0.45, 0.3, 1]
  },
  light: {
    bar: '#2C6AE8',
    card: '#FFFFFF',
    cardOpacity: 1,
    stroke: '#2C6AE8',
    strokeOpacity: 0.3,
    rows: [0.8, 0.55, 0.3],
    bars: [0.5, 0.32, 1]
  }
};

/** 그림 한 칸. 왼쪽 끝을 글과 맞춘다 */
function Cell({ children, className }: {children: React.ReactNode;className?: string;}) {
  return (
    <svg
      viewBox="0 0 200 120"
      preserveAspectRatio="xMinYMid meet"
      aria-hidden="true"
      className={cn('h-[104px] w-full lg:h-[124px]', className)}>

      {children}
    </svg>);

}

/** 1. 카드내역 올리기 — 올라온 거래 줄들 */
export function UploadRows({ tone = 'blue', className }: {tone?: FlowTone;className?: string;}) {
  const t = TONE[tone];
  const rows = [
  { y: 16, width: 150, opacity: t.rows[0] },
  { y: 42, width: 112, opacity: t.rows[1] },
  { y: 68, width: 166, opacity: t.rows[1] },
  { y: 94, width: 92, opacity: t.rows[2] }];

  return (
    <Cell className={className}>
      {rows.map((row) =>
      <rect
        key={row.y}
        x="0"
        y={row.y}
        width={row.width}
        height="12"
        rx="6"
        fill={t.bar}
        fillOpacity={row.opacity} />

      )}
    </Cell>);

}

/** 2. 사업자 문진 — 고른 답 하나만 또렷하다 */
export function InterviewCard({ tone = 'blue', className }: {tone?: FlowTone;className?: string;}) {
  const t = TONE[tone];
  return (
    <Cell className={className}>
      <rect
        x="0"
        y="8"
        width="178"
        height="104"
        rx="16"
        fill={t.card}
        fillOpacity={t.cardOpacity}
        stroke={t.stroke}
        strokeOpacity={t.strokeOpacity}
        strokeWidth="2" />

      <rect x="22" y="32" width="88" height="10" rx="5" fill={t.bar} fillOpacity={t.bars[0]} />
      <rect x="22" y="56" width="134" height="10" rx="5" fill={t.bar} fillOpacity={t.bars[1]} />
      <rect x="22" y="80" width="58" height="10" rx="5" fill={t.bar} fillOpacity={t.bars[2]} />
    </Cell>);

}

/**
 * 3. 건별 판정과 근거 — 막대 대신 결과 화면에 실제로 나오는 카드를 그대로 줄여 놓는다 (#238 리뷰).
 * 배지 기호·색은 utils/verdict.ts 의 VERDICT_META(AVAILABLE = ✓ / ok)와 같다
 */
export function VerdictCard({ tone = 'blue' }: {tone?: FlowTone;}) {
  return (
    <div className="flex h-[104px] items-center lg:h-[124px]" aria-hidden="true">
      <div
        className={cn(
          'w-full max-w-[232px] rounded-xl p-3.5',
          // 연파랑 판 위에서는 surface(1.07)가 묻힌다. 흰 카드에 파란 테를 두른다
          tone === 'light' ? 'border border-accent-line bg-canvas' : 'bg-surface'
        )}>

        <div className="flex items-start justify-between gap-2">
          <p className="text-small font-bold leading-5 text-ink">AWS</p>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ok-line bg-ok-bg px-2 py-0.5 text-caption font-bold text-ok">
            <SymbolIcon symbol="check" />
            가능
          </span>
        </div>
        <p className="mt-0.5 text-body font-bold tabular-nums text-ink">128,000원</p>
        <p className="mt-2.5 border-t border-line pt-2 text-caption text-muted">
          소득세법 제27조 제1항
        </p>
      </div>
    </div>);

}
