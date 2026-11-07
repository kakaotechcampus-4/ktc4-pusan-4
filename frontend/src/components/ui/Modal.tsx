import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  /** 무엇이 일어나는지. 되돌릴 수 없으면 반드시 적는다 */
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** 확인·취소 버튼 */
  footer: React.ReactNode;
  /** 되돌릴 수 없는 동작이면 danger */
  tone?: 'neutral' | 'danger';
  /**
   * lg 는 읽을 거리가 긴 창(약관·처리방침)에 쓴다. 본문이 화면보다 길면 그 안에서 스크롤한다 —
   * 창이 열려 있는 동안 뒤 스크롤을 막기 때문에, 여기서 스크롤하지 않으면 아래를 읽을 길이 없다
   */
  size?: 'md' | 'lg';
}

/**
 * 떠 있는 창. 되돌릴 수 없는 동작을 확인받거나(기본), 읽을 거리를 띄운다(size="lg").
 * Esc 와 바깥 클릭으로 닫히고, 열릴 때 대화상자로 초점을 옮긴다.
 * body 에 바로 그린다. 머리말처럼 backdrop-filter·transform 이 걸린 조상 안에 두면 fixed 가 그 조상 크기에 갇힌다
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  tone = 'neutral',
  size = 'md'
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    // 닫은 뒤 원래 누른 버튼으로 초점을 돌려준다
    const opener = document.activeElement as HTMLElement | null;

    const focusable = () =>
    Array.from(
      panel.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) ?? []
    );

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      // aria-modal 이라고 적었으면 Tab 이 뒤 화면으로 빠져나가지 않아야 한다
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        panel.current?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (active === first || active === panel.current)) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    /*
      읽을 거리(lg)는 창 자체에 초점을 둔다. 첫 요소로 보내면 그게 본문 가운데 링크일 때
      브라우저가 거기까지 밀어서 문서가 중간부터 열린다. 창은 tabIndex=-1 이라 받을 수 있고,
      스크린리더는 제목을 읽는다. Tab 을 누르면 그때 본문 첫 요소로 간다
    */
    (size === 'lg' ? panel.current : focusable()[0] ?? panel.current)?.focus();
    // 뒤 목록이 같이 스크롤되지 않게 한다
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      opener?.focus?.();
    };
  }, [open, size]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}>

      <div aria-hidden="true" className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          'relative flex w-full max-h-[calc(100vh-2rem)] flex-col rounded-2xl border border-line bg-canvas p-6 shadow-panel outline-none motion-safe:animate-rise',
          size === 'lg' ? 'max-w-2xl' : 'max-w-md'
        )}>

        <h2
          id={titleId}
          className={cn(
            'text-h4 font-bold',
            tone === 'danger' ? 'text-deny' : 'text-ink'
          )}>

          {title}
        </h2>
        {description &&
        <p id={descriptionId} className="mt-2.5 text-body leading-6 text-ink2">
            {description}
          </p>
        }
        {/* 제목과 버튼은 제자리에 두고 본문만 민다 */}
        {children && <div className="mt-4 min-h-0 flex-1 overflow-y-auto">{children}</div>}
        <div className="mt-6 flex shrink-0 justify-end gap-2">{footer}</div>
      </div>
    </div>,
    document.body
  );
}
