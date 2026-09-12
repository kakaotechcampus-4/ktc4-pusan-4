import { useEffect, useState } from 'react';
import { JUDGMENTS } from '../mock/judgments';
import { statuteOf } from '../mock/statutes';
import { formatDate, formatWon } from '../utils/format';
import { VerdictBadge } from './VerdictBadge';

/** 히어로에서 순환 재생할 실제 판정 3건 — 가능 · 확인 필요 · 불가 하나씩 */
const SHOWCASE_IDS = ['J-1001', 'J-1005', 'J-1020'];
const SHOWCASE = SHOWCASE_IDS.map(
  (id) => JUDGMENTS.find((judgment) => judgment.id === id)!
);

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

const STEP_MS = 520;
const HOLD_MS = 2600;

export function AgentPreview() {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(0);

  const judgment = SHOWCASE[index];
  const steps = judgment.gateTrace;
  const done = revealed >= steps.length;

  useEffect(() => {
    if (reduceMotion) {
      setRevealed(steps.length);
      return;
    }
    if (!done) {
      const timer = window.setTimeout(() => setRevealed((n) => n + 1), STEP_MS);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      setIndex((i) => (i + 1) % SHOWCASE.length);
      setRevealed(0);
    }, HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [revealed, done, reduceMotion, steps.length]);

  const citation = statuteOf(judgment.citations[0]);

  return (
    <div
      role="img"
      aria-label="판정 에이전트가 카드 거래를 규칙 순서대로 검사하는 화면"
      className="flex h-[420px] w-[340px] flex-col overflow-hidden rounded-2xl bg-ink p-6 text-white shadow-panel">
      <div className="flex items-center justify-between text-caption text-white/55">
        <span className="inline-flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          판정 에이전트 실행 중
        </span>
        <span className="tabular-nums">
          {index + 1} / {SHOWCASE.length}
        </span>
      </div>

      <div
        key={judgment.id}
        className={`mt-5 flex flex-1 flex-col ${reduceMotion ? '' : 'animate-rise'}`}>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-caption text-white/45">
              {formatDate(judgment.transaction.transactedAt)} ·{' '}
              {judgment.transaction.merchantRaw}
            </p>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <p className="text-body-lg font-semibold">
                {judgment.transaction.merchantNorm}
              </p>
              <p className="text-body-lg font-semibold tabular-nums">
                {formatWon(judgment.transaction.amount)}
              </p>
            </div>
          </div>

          <ol className="mt-4 space-y-2 text-small">
            {steps.map((step, i) => {
              const shown = i < revealed;
              const active = i === revealed - 1 && !done;
              return (
                <li
                  key={step.gate}
                  className={`flex items-start gap-3 transition-opacity duration-300 ${
                    shown ? 'opacity-100' : 'opacity-20'
                  }`}>
                  <span
                    className={`mt-0.5 w-7 shrink-0 font-mono text-caption font-semibold tabular-nums ${
                      active ? 'text-accent-line' : 'text-white/45'
                    }`}>
                    {step.gate}
                  </span>
                  <span className="leading-5 text-white/85">{step.result}</span>
                </li>
              );
            })}
          </ol>
          {judgment.blockedAtGate && (
            <p
              className={`mt-3 text-caption text-white/40 transition-opacity duration-300 ${
                done ? 'opacity-100' : 'opacity-0'
              }`}>
              {judgment.blockedAtGate.split('_')[0]}에서 멈춤 · 뒤 게이트는 실행하지
              않습니다
            </p>
          )}

          <div className="mt-auto pt-4">
            <div
              className={`flex items-center justify-between gap-3 border-t border-white/10 pt-4 transition-all duration-300 ease-snap ${
                done ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0'
              }`}>
              <VerdictBadge verdict={judgment.verdict} size="md" />
              {citation && (
                <span className="truncate text-caption text-white/55">
                  {citation.label} · v{citation.statuteVersionId}
                </span>
              )}
            </div>
          </div>
        </div>
    </div>
  );
}
