import { useEffect, useMemo, useState } from 'react';
import logo from '../../assets/brand/logo/preet-logo.svg';
import type { Verdict } from '../../types/domain';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { formatWon } from '../../utils/format';
import { VERDICT_LABEL, VERDICT_META } from '../../utils/verdict';
import { Badge } from '../ui';
import { VerdictGrid, type GridCell } from '../results/VerdictGrid';

/** 미리보기 칸 수. 석 달치 승인내역의 판정이라 치고, 달마다 열 줄쯤 되어 판 폭을 채운다 */
const CELLS = 210;
/** 한 번에 판정색이 되는 칸 수와 그 사이. 다 채우는 데 3초 남짓 걸리고 한 번만 채운다 */
const FILL_STEP = 3;
const FILL_MS = 45;
const START_MS = 500;

/** 늘 같은 그림이 나오게 씨앗을 정한 난수 */
function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

interface SampleCell {
  date: string;
  verdict: Verdict | 'AWAITING';
  amount: number;
}

/** 시연 파일과 비슷한 몫: 가능 60%, 확인 필요 12%, 불가 25%, 답변 대기 3% */
function sampleCells(): SampleCell[] {
  const random = seeded(20261110);
  const days: string[] = [];
  for (const [month, last] of [[7, 31], [8, 31], [9, 30]] as const)
  for (let day = 1; day <= last; day += 1) days.push(`2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  return Array.from({ length: CELLS }, () => {
    const roll = random();
    const verdict: SampleCell['verdict'] = roll < 0.6 ? 'AVAILABLE' : roll < 0.72 ? 'NEEDS_REVIEW' : roll < 0.97 ? 'UNAVAILABLE' : 'AWAITING';
    return {
      date: days[Math.floor(random() * days.length)],
      verdict,
      amount: Math.round((3000 + random() * 90000) / 100) * 100
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

/** 미리보기의 거래 네 줄 */
const ROWS: {merchant: string;amount: number;verdict: Verdict;}[] = [
{ merchant: '스타벅스 역삼점', amount: 6800, verdict: 'AVAILABLE' },
{ merchant: '쿠팡', amount: 48900, verdict: 'NEEDS_REVIEW' },
{ merchant: '카카오T 택시', amount: 12400, verdict: 'AVAILABLE' },
{ merchant: '이마트 성수점', amount: 86300, verdict: 'UNAVAILABLE' }];


/**
 * 로그인 화면 오른쪽의 작은 앱. 실제 결과 화면처럼 금액, 판정 칸 띠, 거래 네 줄이 있고
 * 회색 칸이 한 칸씩 판정색으로 뒤집히며 금액이 오른다. 한 번 다 채우면 멈춘다.
 * 그림이라 화면 읽기 프로그램에는 감추고, 초점이 가는 요소를 두지 않는다
 */
export function AppPreview() {
  const reduced = useReducedMotion();
  const samples = useMemo(sampleCells, []);
  const [filled, setFilled] = useState(0);
  const shown = reduced ? samples.length : filled;

  useEffect(() => {
    if (reduced) return;
    let timer = 0;
    const begin = window.setTimeout(() => {
      timer = window.setInterval(() => {
        setFilled((count) => {
          if (count + FILL_STEP >= samples.length) window.clearInterval(timer);
          return Math.min(samples.length, count + FILL_STEP);
        });
      }, FILL_MS);
    }, START_MS);
    return () => {
      window.clearTimeout(begin);
      window.clearInterval(timer);
    };
  }, [reduced, samples.length]);

  const cells: GridCell[] = samples.map((sample, index) => ({
    key: String(index),
    date: sample.date,
    state: index < shown ? sample.verdict : 'PENDING'
  }));
  const amount = samples.slice(0, shown).reduce((sum, sample) => sum + (sample.verdict === 'AVAILABLE' ? sample.amount : 0), 0);

  return (
    <div aria-hidden="true" className="w-full max-w-[34rem] overflow-hidden rounded-2xl bg-canvas">
      <div className="flex items-center gap-3 border-b border-line pl-5 pr-6 py-3.5">
        <img src={logo} alt="" className="h-5 w-auto" />
        <span className="ml-auto flex items-center gap-1.5">
          <span className="h-5 w-12 rounded-full bg-surface" />
          <span className="h-5 w-12 rounded-full bg-surface" />
          <span className="h-5 w-12 rounded-full bg-accent" />
          <span className="h-5 w-12 rounded-full bg-surface" />
        </span>
      </div>
      <div className="px-6 pb-5 pt-6">
        <p className="text-caption text-ink2">경비 가능 금액</p>
        <p className="mt-1 text-h2 font-bold tabular-nums tracking-ir-sm text-ink">{formatWon(amount)}</p>
        <VerdictGrid className="mt-5" cells={cells} size="sm" legend={false} />
        <ul className="mt-5 divide-y divide-line border-t border-line">
          {ROWS.map((row) =>
          <li key={row.merchant} className="flex items-center gap-3 py-2.5 text-small">
              <span className="min-w-0 flex-1 truncate text-ink">{row.merchant}</span>
              <span className="tabular-nums text-ink2">{formatWon(row.amount)}</span>
              <Badge tone={VERDICT_META[row.verdict].tone} symbol={VERDICT_META[row.verdict].symbol}>
                {VERDICT_LABEL[row.verdict]}
              </Badge>
            </li>
          )}
        </ul>
      </div>
    </div>);

}
