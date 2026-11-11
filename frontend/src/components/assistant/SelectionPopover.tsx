import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BookOpenIcon, MessageCircleQuestionIcon, XIcon } from 'lucide-react';
import { askBus, askTargetOf, type AskTarget } from './ask';
import { lookup } from '../../rules/glossary';
import type { GlossaryTerm } from '../../types/rules';
import { statuteTitle } from '../../utils/statute';

/** 화면 글이 아닌 곳. 비서 패널, 이 상자, 입력칸의 글은 보지 않는다 */
const SKIP = 'section[aria-label="비서 Really"], [data-selection-popover], input, textarea';

/** 판정 이유와 근거 조문은 풀어 달라고 하고, 나머지(거래, 금액 판, 한도)는 그것에 대해 묻는다 */
const askText = (target: AskTarget) => target.kind === 'reason' || target.kind === 'statute' ? '쉽게 풀어 달라기' : 'Really에게 묻기';

/** 조문 id 에서 법령 이름. 소득세법시행령 → 소득세법 시행령 */
const lawName = (statuteId: string) => statuteId.split(/[#-]/)[0].replace(/(시행령|시행규칙)$/, ' $1');

/** 머리띠(72px) 높이, 화면 가장자리에서 띄우는 거리, 낱말과의 거리 */
const HEADER = 72;
const EDGE = 16;
const GAP = 8;

const BUTTON = 'flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 transition-colors duration-150 hover:bg-surface';

interface Picked {
  /** 고른 글이 용어집의 낱말 하나와 같을 때 */
  term: GlossaryTerm | null;
  /** 고른 글이 Really 에게 물을 수 있는 곳(data-ask) 안에 있을 때 */
  target: AskTarget | null;
  /** 고른 낱말의 가운데와 위아래 */
  x: number;
  top: number;
  bottom: number;
}

/**
 * 화면의 글을 고르면 그 위에 작은 단추가 뜬다.
 * - 뜻: 고른 글이 용어집(rules/glossary.yaml)의 낱말 하나와 같으면, 모델을 부르지 않고 풀이를 보인다
 * - Really에게 묻기, 쉽게 풀어 달라기: 고른 글이 거래 행, 상세 패널, 금액 판, 한도, 판정 이유, 근거 조문 안에 있으면
 *   그것을 Really 에 붙인다. Really 버튼을 끌어 놓은 것과 같다. 고른 글 자체는 보내지 않는다.
 *   비서는 대화의 사용자 말을 제안의 근거로 쓰므로(ai/assistant/agent.py) 화면 글을 말에 섞지 않는다
 * 둘 다 아니면 아무것도 뜨지 않는다
 */
export function SelectionPopover() {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{left: number;top: number;} | null>(null);

  const hide = useCallback(() => {
    setPicked(null);
    setOpen(false);
    setPlace(null);
  }, []);

  // 화면을 옮기면 닫는다. 고른 낱말은 앞 화면에 있었다
  const { pathname } = useLocation();
  useEffect(hide, [pathname, hide]);

  useEffect(() => {
    const read = () => {
      const selection = window.getSelection();
      const text = selection?.toString() ?? '';
      if (!selection || selection.isCollapsed || selection.rangeCount === 0 || text.trim().length < 2) return;
      const range = selection.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const element = node instanceof Element ? node : node.parentElement;
      if (!element || element.closest(SKIP)) return;
      const term = lookup(text);
      const target = askTargetOf(element)?.target ?? null;
      if (!term && !target) return;
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      setOpen(false);
      setPicked({ term, target, x: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom });
    };
    const inside = (event: Event) => event.target instanceof Element && event.target.closest('[data-selection-popover]');
    // 놓은 뒤 한 박자 쉬고 읽는다. 고른 자리를 다시 누르면 고른 것이 그때 풀린다
    const onUp = (event: Event) => {
      if (!inside(event)) window.setTimeout(read, 0);
    };
    const onDown = (event: PointerEvent) => {
      if (!inside(event)) hide();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();else
      if (event.shiftKey) window.setTimeout(read, 0);
    };
    document.addEventListener('mouseup', onUp);
    document.addEventListener('keyup', onKey);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('keyup', onKey);
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [hide]);

  // 그리기 전에 상자 크기를 재서 자리를 정한다. 단추와 뜻 상자는 너비가 달라 각자 크기로 화면 안에 맞춘다.
  // 낱말 위에 두면 머리띠에 걸릴 때는 낱말 아래에 띄운다. offset 크기는 등장 애니메이션의 transform 을 타지 않는다
  useLayoutEffect(() => {
    if (!picked || !box.current) return;
    const { offsetWidth: width, offsetHeight: height } = box.current;
    const half = width / 2 + EDGE;
    const above = picked.top - GAP - height;
    setPlace({
      left: Math.min(Math.max(picked.x, half), window.innerWidth - half) - width / 2,
      top: above < HEADER + GAP ? picked.bottom + GAP : above
    });
  }, [picked, open]);

  if (!picked) return null;
  const { term, target } = picked;

  const ask = () => {
    if (!target) return;
    window.getSelection()?.removeAllRanges();
    hide();
    askBus.emit(target);
  };

  return (
    <div
      ref={box}
      data-selection-popover=""
      className="fixed z-[75] w-max max-w-[20rem]"
      style={place ?? { left: 0, top: 0, visibility: 'hidden' }}>

      {open && term ?
      <div role="dialog" aria-label={`${term.term} 뜻`} className="rounded-2xl border border-edge bg-canvas p-4 text-small shadow-panel motion-safe:animate-enter">
          <div className="flex items-start gap-2">
            <p className="flex-1 font-bold text-ink">{term.term}</p>
            <button type="button" aria-label="닫기" onClick={hide} className="-m-1 rounded-lg p-1 text-muted hover:bg-surface hover:text-ink">
              <XIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1.5 leading-6 text-ink2">{term.body}</p>
          {term.statute && <p className="mt-1.5 text-caption text-ink2">{statuteTitle(term.statute, lawName(term.statute))}</p>}
        </div> :

      <div className="flex items-center gap-0.5 rounded-full border border-edge bg-canvas p-0.5 text-caption font-bold text-ink shadow-panel">
          {term &&
        <button type="button" onClick={() => setOpen(true)} className={BUTTON}>
              <BookOpenIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {term.term} 뜻
            </button>
        }
          {target &&
        <button type="button" onClick={ask} className={BUTTON}>
              <MessageCircleQuestionIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {askText(target)}
            </button>
        }
        </div>
      }
    </div>);

}
