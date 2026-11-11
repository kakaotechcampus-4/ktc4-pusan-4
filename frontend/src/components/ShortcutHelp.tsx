import { useEffect, useState } from 'react';
import { Button, Modal } from './ui';

export interface Shortcut {
  keys: string[];
  label: string;
}

/** 입력칸에서 친 글자는 단축키가 아니다 */
const typingIn = (target: EventTarget | null) =>
target instanceof HTMLElement && (
target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * ? 를 누르면 이 화면의 단축키 목록을 띄운다. 입력칸에 초점이 있으면 듣지 않는다.
 * 다른 창(확인 창, 비서 패널)이 떠 있을 때도 듣지 않는다
 */
export function ShortcutHelp({ shortcuts }: {shortcuts: Shortcut[];}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // 자판에 따라 ? 가 Shift + / 로만 들어온다
      const question = event.key === '?' || event.key === '/' && event.shiftKey;
      if (!question || event.metaKey || event.ctrlKey || event.altKey) return;
      if (typingIn(event.target) || document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="단축키"
      footer={
      <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
          닫기
        </Button>
      }>

      <dl className="divide-y divide-line">
        {shortcuts.map((shortcut) =>
        <div key={shortcut.label} className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-body text-ink">{shortcut.label}</dt>
            <dd className="flex shrink-0 gap-1">
              {shortcut.keys.map((key) =>
            <kbd
              key={key}
              className="min-w-7 rounded-md border border-edge px-1.5 py-0.5 text-center text-small font-bold text-ink">
                  {key}
                </kbd>
            )}
            </dd>
          </div>
        )}
      </dl>
    </Modal>);

}
