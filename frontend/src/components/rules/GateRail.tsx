import { useState } from 'react';
import { ChevronRightIcon } from 'lucide-react';
import type { Judgment, Verdict } from '../../types/domain';
import { gateTrace } from '../../rules/trace';
import { cn } from '../ui';
import { CardGraph } from './CardGraph';

const STOP_DOT: Record<Verdict, string> = {
  AVAILABLE: 'bg-ok-bar',
  NEEDS_REVIEW: 'bg-warn-bar',
  UNAVAILABLE: 'bg-deny-bar'
};

/**
 * 상세 패널의 관문 띠. 판정이 G1~G6 을 어떻게 지났는지 한 줄로 보이고, 누르면 카드 전체 그래프가 열린다.
 * 직접 바꾼 판정이면 자동 판정(engine)의 길을 그린다. 자동 판정을 아직 못 읽었으면 그리지 않는다
 */
export function GateRail({ judgment, title }: {judgment: Judgment;title: string;}) {
  const [open, setOpen] = useState(false);
  const trace = gateTrace(judgment);
  const verdict = judgment.verdict.code;
  const stopIndex = trace.steps.findIndex((step) => step.state === 'stop');
  /** 버튼 안에는 목록을 둘 수 없다. 그림은 숨기고 길을 한 문장으로 읽어 준다 */
  const spoken = trace.steps.
  map((step) => {
    // 카드 번호는 읽어 주지 않는다. 이름이 있으면 이름을 읽는다
    const first = step.applied[0];
    const card = first && 'name' in first ? first.name : null;
    const state =
    step.state === 'stop' ?
    trace.noRule ? '맞는 규칙 없음' : '여기서 정해짐' :
    step.state === 'unreached' ?
    '가지 않음' :
    '지남';
    return `${step.name} ${state}${card ? ` ${card}` : ''}`;
  }).
  join(', ');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`판정 경로: ${spoken}.${trace.stale ? ' 판정 당시 카드와 지금 카드가 다를 수 있습니다.' : ''} 카드 전체 보기`}
        className="group -mx-2 block w-[calc(100%+1rem)] rounded-xl px-2 py-2 text-left transition-colors duration-150 hover:bg-surface">

        <span aria-hidden="true" className="flex items-center justify-between gap-2">
          <span className="text-body font-bold text-ink">판정 경로</span>
          <span className="inline-flex items-center gap-0.5 text-small text-ink2 group-hover:text-ink">
            카드 전체
            <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
          </span>
        </span>
        <span aria-hidden="true" className="mt-3 grid grid-cols-6">
          {trace.steps.map((step, index) => {
            const reached = stopIndex < 0 || index <= stopIndex;
            const nextReached = stopIndex < 0 || index + 1 <= stopIndex;
            return (
              <span key={step.gate} className="relative flex flex-col items-center text-center">
                {index < trace.steps.length - 1 &&
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute left-1/2 top-[5px] h-0.5 w-full',
                    nextReached ? 'bg-accent' : 'border-t-2 border-dashed border-line'
                  )} />

                }
                <span
                  aria-hidden="true"
                  className={cn(
                    'relative z-10 h-3 w-3 rounded-full',
                    step.state === 'stop' ?
                    cn(STOP_DOT[verdict], 'ring-[3px] ring-canvas group-hover:ring-surface') :
                    // 맞는 카드가 없어도 그 관문을 지났다. 다 지난 판정은 한도까지 점이 찬다
                    step.state === 'unreached' ?
                    'border-2 border-line bg-canvas' :
                    'bg-accent'
                  )} />

                <span className={cn('mt-1.5 text-caption', reached ? 'text-ink' : 'text-muted')}>{step.name}</span>
              </span>);

          })}
        </span>
        {trace.stale && <span className="mt-2 block text-caption text-ink2">판정 당시 카드와 지금 카드가 다를 수 있습니다.</span>}
      </button>
      <CardGraph open={open} onClose={() => setOpen(false)} title={title} trace={trace} verdict={verdict} />
    </>);

}
