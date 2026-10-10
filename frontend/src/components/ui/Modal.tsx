import React, { useEffect, useId, useRef } from 'react';
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
}

/**
 * 확인 대화상자. 되돌릴 수 없는 동작 앞에서만 쓴다.
 * Esc 와 바깥 클릭으로 닫히고, 열릴 때 대화상자로 초점을 옮긴다.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  tone = 'neutral'
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
    (focusable()[0] ?? panel.current)?.focus();
    // 뒤 목록이 같이 스크롤되지 않게 한다
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
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
        className="relative w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-panel outline-none motion-safe:animate-rise">

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
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6 flex justify-end gap-2">{footer}</div>
      </div>
    </div>);

}
