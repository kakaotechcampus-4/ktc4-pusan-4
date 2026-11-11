import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheetIcon, LockIcon } from 'lucide-react';
import type { ParsedOutcome } from '../../parser';
import { merchantName } from '../results/display';
import { VerdictGrid } from '../results/VerdictGrid';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { formatFullDate, formatNumber, formatWon } from '../../utils/format';
import { cn } from '../ui';
import { LiveBorder } from './LiveBorder';
import { pendingCells } from './pendingCells';

/** 파일 카드가 칸 안으로 미끄러져 들어오는 시간 */
const CHIP_MS = 520;
/** 줄이 흐르는 시간. 줄이 적으면 짧고 많아도 이보다 길지 않다 */
const streamMs = (rows: number) => Math.min(1600, Math.max(700, rows * 30));
/** 다 흐른 뒤 접기 전에 머무는 시간과 접히는 시간 */
const HOLD_MS = 300;
const FOLD_MS = 600;
/** 흘려 보이는 줄 수. 나머지는 숫자로만 센다 */
const STREAM_ROWS = 60;
/** 한 번에 보이는 줄 수. 위아래 끝은 흐리게 지운다 */
const WINDOW_ROWS = 8;

type Stage = 'chip' | 'stream' | 'fold' | 'done';

/**
 * 파일마다 언제 읽기 시작했는지. 화면에 갔다 오거나 읽기가 끝나 카드가 바뀌어도 처음부터 다시 흐르지 않고
 * 이어서 흐르거나 끝난 모습을 보인다. 새로고침하면 사라진다
 */
const timelines = new WeakMap<File, {start: number;rowsAt: number | null;}>();

function timelineOf(file: File, ready: boolean) {
  let line = timelines.get(file);
  if (!line) {
    line = { start: performance.now(), rowsAt: null };
    timelines.set(file, line);
  }
  // 다 읽은 때. 파일 카드가 다 들어온 뒤에 흐르기 시작한다
  if (ready && line.rowsAt === null) line.rowsAt = Math.max(performance.now(), line.start + CHIP_MS);
  return line;
}

function stageAt(now: number, line: {start: number;rowsAt: number | null;}, rows: number): {stage: Stage;progress: number;} {
  if (line.rowsAt === null || now < line.rowsAt) return { stage: 'chip', progress: 0 };
  const elapsed = now - line.rowsAt;
  const stream = streamMs(rows);
  if (elapsed < stream) return { stage: 'stream', progress: elapsed / stream };
  if (elapsed < stream + HOLD_MS) return { stage: 'stream', progress: 1 };
  if (elapsed < stream + HOLD_MS + FOLD_MS) return { stage: 'fold', progress: 1 };
  return { stage: 'done', progress: 1 };
}

/**
 * 읽은 거래. 놓은 파일 카드가 칸 안으로 들어오고, 읽은 거래가 고정폭 글꼴로 한 줄씩 흐르며 왼쪽 숫자가 오른다.
 * 다 흐르면 줄들이 판정 전 칸으로 접혀 달마다 묶인다.
 *
 * 그림만 바꾼다. 읽기, 올리기, Idempotency-Key, 화면 이동은 이 움직임을 기다리지 않는다.
 * 움직임 줄이기를 켰으면 끝난 모습(숫자와 칸)을 바로 보인다.
 * outcome 이 null 이면 아직 읽는 중이다
 */
export function ReadPanel({ file, outcome }: {file: File;outcome: ParsedOutcome | null;}) {
  const reduced = useReducedMotion();
  const rows = outcome?.rows ?? [];
  const line = timelineOf(file, outcome !== null);
  const [now, setNow] = useState(() => performance.now());
  const { stage, progress } = reduced ? { stage: 'done' as Stage, progress: 1 } : stageAt(now, line, rows.length);
  const cells = useMemo(() => pendingCells(outcome?.request ?? null), [outcome]);
  /** 처음 그릴 때 이미 끝났으면(다른 화면에 갔다 왔으면) 칸이 다시 튀어나오지 않는다 */
  const [doneAtMount] = useState(stage === 'done');

  // 끝날 때까지 한 프레임마다 시각을 읽는다
  useEffect(() => {
    if (stage === 'done') return;
    let frame = requestAnimationFrame(function tick(at) {
      setNow(at);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [stage]);

  const chip = useRef<HTMLDivElement>(null);
  // 파일 카드가 왼쪽 위에서 비스듬히 미끄러져 들어온다. 다시 그려도(읽기가 끝나 카드가 바뀌어도) 이어서 움직인다
  useLayoutEffect(() => {
    const element = chip.current;
    if (!element || typeof element.animate !== 'function') return;
    const motion = element.animate(
      [
      { transform: 'translate(-56px, -28px) rotate(-5deg)', opacity: 0 },
      { transform: 'translate(-12px, -6px) rotate(-1.5deg)', opacity: 1, offset: 0.6 },
      { transform: 'none', opacity: 1 }],

      { duration: CHIP_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'backwards' }
    );
    motion.currentTime = Math.min(CHIP_MS, performance.now() - line.start);
    return () => motion.cancel();
    // 파일 카드가 처음 놓일 때만 돈다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage === 'chip']);

  const streamed = rows.slice(0, STREAM_ROWS);
  const shown = stage === 'stream' || stage === 'fold' ? Math.max(1, Math.ceil(progress * streamed.length)) : 0;
  const windowRows = streamed.slice(Math.max(0, shown - WINDOW_ROWS), shown);
  const count = stage === 'chip' ? 0 : stage === 'stream' ? Math.round(progress * rows.length) : rows.length;
  const reading = stage === 'chip' || stage === 'stream';

  return (
    <section
      aria-label="읽은 거래"
      aria-busy={outcome === null}
      className={cn(
        'relative grid gap-6 rounded-2xl p-5 transition-colors duration-200 ease-motion sm:grid-cols-[14rem_minmax(0,1fr)] sm:p-6',
        // 테두리 굵기를 같게 두어 접힐 때 칸이 1px 밀리지 않게 한다
        reading ? 'border border-transparent bg-accent-soft/40' : 'border border-line bg-canvas'
      )}>

      {reading && <LiveBorder tone="accent" moving />}
      <div className="relative min-w-0">
        <p className="text-small text-ink2">읽은 거래</p>
        <p className="mt-1 text-stat font-bold tabular-nums text-ink">
          <span aria-hidden="true">{formatNumber(count)}</span>
          {/* 오르는 중간 숫자는 읽어 주지 않는다 */}
          <span className="sr-only">{outcome ? `${formatNumber(rows.length)}건` : '파일을 읽고 있습니다'}</span>
        </p>
        <p className="mt-3 flex items-start gap-1.5 text-caption text-ink2">
          <LockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          원본 파일은 이 브라우저에서만 읽습니다
        </p>
      </div>

      <div aria-hidden="true" className="relative min-h-[148px] min-w-0">
        {stage === 'chip' &&
        <div className="flex h-full min-h-[148px] items-center justify-center">
            <div
            ref={chip}
            className="inline-flex max-w-full items-center gap-2 rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-body text-ink shadow-[0_8px_20px_-10px_rgba(25,31,40,0.35)]">

              <FileSpreadsheetIcon className="h-4 w-4 shrink-0 text-ok-bar" />
              <span className="truncate">{file.name}</span>
            </div>
          </div>
        }

        {(stage === 'stream' || stage === 'fold') &&
        <div
          className={cn(
            'absolute inset-0 overflow-hidden font-mono text-caption text-ink2 transition-[opacity,transform] ease-motion',
            stage === 'fold' ? 'origin-bottom scale-y-[0.25] opacity-0 duration-500' : 'duration-200'
          )}
          style={{
            maskImage: 'linear-gradient(transparent, #000 28%, #000 72%, transparent)',
            WebkitMaskImage: 'linear-gradient(transparent, #000 28%, #000 72%, transparent)'
          }}>

            <div className="absolute bottom-3 left-0 w-full max-w-[34rem]">
              {windowRows.map((row, index) =>
            <p key={shown - windowRows.length + index} className="flex gap-4 whitespace-nowrap leading-[18px] motion-safe:animate-enter">
                  <span className="shrink-0 tabular-nums">{row.approvedAt ? formatFullDate(row.approvedAt) : '-'}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{merchantName(row.rawMerchant) || '-'}</span>
                  <span className="shrink-0 tabular-nums">{row.amount === null ? '-' : formatWon(row.amount)}</span>
                </p>
            )}
            </div>
          </div>
        }

        {(stage === 'fold' || stage === 'done') && cells.length > 0 &&
        <VerdictGrid cells={cells} animate={!doneAtMount} fit />
        }
      </div>
    </section>);

}
