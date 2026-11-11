import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRightIcon } from 'lucide-react';
import type { Verdict } from '../../types/domain';
import type { RuleCardInfo } from '../../types/rules';
import { CARDS, GATES, cardUrl, cardsOf } from '../../rules/cards';
import { cardSummary } from '../../rules/summary';
import type { GateState, GateTrace } from '../../rules/trace';
import { VERDICT_LABEL } from '../../utils/verdict';
import { ro } from '../../utils/format';
import { Button, Modal, cn } from '../ui';

/** 관문을 어떻게 지났는지. 화면에는 쓰지 않고 화면 읽기 프로그램에만 읽어 준다 */
const STATE_TEXT: Record<GateState, string> = {
  stop: '여기서 정해짐',
  pass: '지남',
  applied: '지남',
  none: '지남',
  unreached: '가지 않음'
};

/** 멈춘 점은 판정색이다 */
const STOP_DOT: Record<Verdict, string> = {
  AVAILABLE: 'bg-ok-bar',
  NEEDS_REVIEW: 'bg-warn-bar',
  UNAVAILABLE: 'bg-deny-bar'
};

/** 카드에 마우스를 올리면 그 카드 위에 뜨는 한 줄 */
type Tip = {text: string;x: number;y: number;};

/**
 * 규칙 카드 전체를 관문 안에 세운 그래프. 판정을 주면 그 거래가 지나간 길을 칠한다.
 * 관문 이름과 카드 이름만 둔다. 카드 번호, 카드 수, 지남 같은 설명은 쓰지 않는다(11/11 치오).
 * 지나간 길은 파란 선과 점, 멈춘 관문은 판정색 점, 가지 않은 관문은 빈 점과 점선이다
 */
export function CardGraph({
  open,
  onClose,
  title,
  trace,
  verdict,
  links = false
}: {open: boolean;onClose: () => void;title: string;trace?: GateTrace | null;verdict?: Verdict;links?: boolean;}) {
  const appliedIds = new Set(trace?.steps.flatMap((step) => step.applied.map((card) => card.id)) ?? []);
  /**
   * 카드가 무엇을 하는지 아주 짧게(cardSummary). 브라우저 title 은 늦게 뜨고 이름만 되풀이해서 말풍선을 직접 띄운다(11/11 치오).
   * 창 안이 스크롤되면 자리가 어긋나서 닫는다
   */
  const [tip, setTip] = useState<Tip | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = tipRef.current;
    if (!tip || !element) return;
    const max = document.documentElement.clientWidth - element.offsetWidth - 8;
    element.style.left = `${Math.max(8, Math.min(tip.x - element.offsetWidth / 2, max))}px`;
  }, [tip]);
  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [tip]);
  useEffect(() => {
    if (!open) setTip(null);
  }, [open]);
  const tipProps = (card: RuleCardInfo) => {
    const show = (event: React.SyntheticEvent<HTMLElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      setTip({ text: cardSummary(card), x: rect.left + rect.width / 2, y: rect.top });
    };
    const hide = () => setTip(null);
    return { onPointerEnter: show, onPointerLeave: hide, onFocus: show, onBlur: hide };
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={title}
      footer={
      <Button variant="secondary" size="sm" onClick={onClose}>
          닫기
        </Button>
      }>

      <ol className="relative">
        {GATES.map((gate, index) => {
          const step = trace?.steps.find((item) => item.gate === gate.id);
          const cards = cardsOf(gate.id);
          // 판정에 적용됐지만 지금 빌드에 없는 카드(지운 카드)도 그 관문에 적용된 칸으로 둔다. 이름을 몰라 그렇게 쓴다
          const gone = step?.applied.filter((card) => !('gate' in card)) ?? [];
          const state = step?.state;
          const last = index === GATES.length - 1;
          return (
            <li key={gate.id} className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 pb-5 last:pb-0">
              {/* 관문을 잇는 세로선. 지나간 길은 파랗고, 가지 않은 길은 점선이다 */}
              {!last &&
              <span
                aria-hidden="true"
                className={cn(
                  'absolute left-[0.6875rem] top-4 h-[calc(100%-0.5rem)] w-0.5',
                  !trace ?
                  'bg-line' :
                  state === 'stop' || state === 'unreached' ?
                  'border-l-2 border-dashed border-line' :
                  'bg-accent'
                )} />

              }
              <span
                aria-hidden="true"
                className={cn(
                  'relative z-10 mt-1 h-3.5 w-3.5 justify-self-center rounded-full',
                  !trace ?
                  'bg-ink2' :
                  state === 'stop' ?
                  cn(STOP_DOT[verdict ?? 'NEEDS_REVIEW'], 'ring-4 ring-canvas') :
                  state === 'unreached' ?
                  'border-2 border-line bg-canvas' :
                  'bg-accent'
                )} />

              <div className="min-w-0">
                <p className="text-body font-bold text-ink">
                  {gate.id} {gate.name}
                  {state &&
                  <span className="sr-only">
                      , {state === 'stop' && verdict ? `${VERDICT_LABEL[verdict]}${ro(VERDICT_LABEL[verdict])} 정해짐` : STATE_TEXT[state]}
                    </span>
                  }
                </p>
                {cards.length + gone.length > 0 &&
                <ul className="mt-2 flex flex-wrap gap-1.5">
                    {gone.map((card) =>
                  <li key={card.id}>
                        <span className="inline-flex items-center whitespace-nowrap rounded-lg bg-accent px-2 py-1 text-caption font-bold text-white">
                          지금 없는 카드
                        </span>
                      </li>
                  )}
                    {cards.map((card) => {
                    const applied = appliedIds.has(card.id);
                    const chip = cn(
                      'inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 text-caption',
                      applied ?
                      'bg-accent font-bold text-white' :
                      trace ?
                      'border border-line text-muted' :
                      'border border-line text-ink2'
                    );
                    return (
                      <li key={card.id}>
                          {links ?
                        <a
                          href={cardUrl(card)}
                          target="_blank"
                          rel="noreferrer"
                          {...tipProps(card)}
                          className={cn(chip, 'transition-colors duration-150 hover:border-ink hover:text-ink')}>

                              {card.name}
                              <span className="sr-only">, {cardSummary(card)}</span>
                              <ArrowUpRightIcon className="h-3 w-3" aria-hidden="true" />
                            </a> :

                        <span {...tipProps(card)} className={cn(chip, 'cursor-default')}>
                              {card.name}
                              {applied && <span className="sr-only">, 이 거래에 적용</span>}
                              <span className="sr-only">, {cardSummary(card)}</span>
                            </span>
                        }
                        </li>);

                  })}
                  </ul>
                }
              </div>
            </li>);

        })}
      </ol>
      <p className="sr-only">규칙 카드 {CARDS.length}장</p>
      {tip && typeof document !== 'undefined' &&
      createPortal(
        <div
          ref={tipRef}
          role="tooltip"
          className="pointer-events-none fixed z-[60] max-w-72 -translate-y-full rounded-xl bg-ink px-3 py-2 text-caption text-white [word-break:keep-all]"
          style={{ top: tip.y - 8, left: tip.x }}>

            {tip.text}
          </div>,
        document.body
      )}
    </Modal>);

}
