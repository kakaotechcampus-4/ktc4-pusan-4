import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { ASK_ATTR, ASK_LABEL, askBus, askTargetOf, type AskTarget } from './ask';

/** 이만큼 움직여야 끌기로 본다. 그보다 짧으면 그냥 누른 것이라 패널을 연다 */
const DRAG_PX = 6;

const DROP = 'ask-drop';
const DROP_OVER = 'ask-drop-over';

/**
 * Really 버튼을 끌어 거래 행, 상세 패널, 근거 조문, 금액 판, 한도에 놓으면 그것에 대해 묻는다.
 * 놓을 수 있는 곳은 data-ask 가 붙은 요소다. 끄는 동안 그곳들에 점선을 두르고, 위에 오면 칠한다.
 * Esc 를 누르거나 놓을 곳 밖에서 놓으면 아무 일도 없다.
 *
 * 버튼 안의 그림을 브라우저가 따로 끌기 시작하면 pointercancel 이 와서 끌기가 끊긴다.
 * 그림에는 draggable={false} 를 두고 dragstart 도 막는다
 */
export function useDragAsk(enabled: boolean, image: string) {
  const start = useRef<{x: number;y: number;} | null>(null);
  const moved = useRef(false);
  const target = useRef<AskTarget | null>(null);
  const over = useRef<HTMLElement | null>(null);
  const [ghost, setGhost] = useState<{x: number;y: number;label: string | null;} | null>(null);

  const markAll = (on: boolean) =>
  document.querySelectorAll<HTMLElement>(`[${ASK_ATTR}]`).forEach((element) => element.classList.toggle(DROP, on));

  const setOver = (element: HTMLElement | null) => {
    if (over.current === element) return;
    over.current?.classList.remove(DROP_OVER);
    over.current = element;
    element?.classList.add(DROP_OVER);
  };

  const finish = useCallback((commit: boolean) => {
    const picked = target.current;
    markAll(false);
    setOver(null);
    target.current = null;
    start.current = null;
    setGhost(null);
    if (commit && picked) askBus.emit(picked);
  }, []);

  /*
   * 끄는 동안. Esc 를 누르면 그만둔다.
   * 버튼이 놓기(pointerup)를 못 받는 때가 있다: 창 밖에서 놓거나, 다른 창으로 넘어가거나, 붙잡기(pointer capture)를
   * 잃을 때다. 그러면 끌던 그림이 놓은 자리에 그대로 남는다(11/11 치오). 창에서도 놓기를 듣고, 창을 떠나면 그만둔다.
   * 버튼이 먼저 받아 끝냈으면 여기서는 할 일이 없다(놓을 곳이 이미 비어 있다)
   */
  useEffect(() => {
    if (!ghost) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(false);
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('blur', onCancel);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('blur', onCancel);
    };
  }, [ghost, finish]);

  // 패널이 열리거나 화면을 떠나면 칠한 것을 지운다
  useEffect(() => () => finish(false), [enabled, finish]);

  const bind: React.ButtonHTMLAttributes<HTMLButtonElement> = enabled ?
  {
    // 손가락으로 끌 때 화면이 같이 움직이지 않게 한다
    style: { touchAction: 'none' },
    onDragStart: (event) => event.preventDefault(),
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      // 끄는 동안 지나가는 화면 글이 골라지지 않게 한다. 누르기(click)는 그대로 온다
      event.preventDefault();
      start.current = { x: event.clientX, y: event.clientY };
      moved.current = false;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event) => {
      if (!start.current) return;
      if (!moved.current) {
        if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) < DRAG_PX) return;
        moved.current = true;
        markAll(true);
      }
      const found = askTargetOf(document.elementFromPoint(event.clientX, event.clientY));
      target.current = found?.target ?? null;
      setOver(found?.element ?? null);
      setGhost({ x: event.clientX, y: event.clientY, label: found ? ASK_LABEL[found.target.kind] : null });
    },
    onPointerUp: () => {
      if (moved.current) finish(true);else
      start.current = null;
    },
    onPointerCancel: () => finish(false),
    // 놓기 없이 붙잡기를 잃으면(요소가 다시 그려지거나 브라우저가 거둔 때) 그만둔다. 놓은 뒤에 오는 것은 이미 끝난 뒤다
    onLostPointerCapture: () => {
      if (start.current) finish(false);
    }
  } :
  {};

  /** 끌기가 끝난 뒤 따라오는 click 은 패널을 여닫지 않는다 */
  const consumeClick = () => {
    if (!moved.current) return false;
    moved.current = false;
    return true;
  };

  const ghostNode = ghost &&
  <div className="pointer-events-none fixed z-[90] flex items-center gap-2" style={{ left: ghost.x - 24, top: ghost.y - 24 }}>
      <img src={image} alt="" className="h-12 w-12 rounded-full opacity-90" />
      {ghost.label &&
    <span className="whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-caption font-bold text-white">{ghost.label}</span>
    }
    </div>;

  return { bind, ghost: ghostNode, consumeClick };
}
