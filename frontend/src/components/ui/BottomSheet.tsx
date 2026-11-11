import React, { useEffect, useId, useRef } from 'react';
import { XIcon } from 'lucide-react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** 화면 읽기 프로그램이 읽을 이름. 눈에 보이는 제목은 children 이 그린다 */
  label: string;
  children: React.ReactNode;
}

/**
 * 좁은 화면에서 아래에서 올라오는 창. 뒤 화면은 어둡게 덮고 스크롤을 막는다.
 * Esc·바깥 누르기·닫기 버튼으로 닫히고, 닫히면 연 버튼으로 초점을 돌려준다
 */
export function BottomSheet({ open, onClose, label, children }: BottomSheetProps) {
  const labelId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      // aria-modal 이라고 적었으니 Tab 이 뒤 화면으로 빠져나가지 않게 한다 (Modal 과 같다)
      if (event.key !== 'Tab' || !panel.current) return;
      const items = Array.from(
        panel.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      const active = document.activeElement;
      if (items.length === 0) {
        event.preventDefault();
        panel.current.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (!event.shiftKey && (active === last || !panel.current.contains(active))) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (active === first || active === panel.current)) {
        event.preventDefault();
        last.focus();
      }
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    panel.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/40" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-sheet pb-6 outline-none">
        
        <div className="sticky top-0 z-10 flex h-12 items-center justify-between bg-sheet px-4">
          <span aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-line" />
          <span id={labelId} className="sr-only">{label}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="absolute right-3 top-2 rounded-full p-2 text-muted hover:bg-surface hover:text-ink">
            
            <XIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="px-3">{children}</div>
      </div>
    </div>);

}
