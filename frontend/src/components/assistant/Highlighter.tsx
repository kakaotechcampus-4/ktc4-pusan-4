import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { highlightBus, REF_ATTR } from './ask';

const CLASS = 'ask-target';

const clear = () => document.querySelectorAll(`.${CLASS}`).forEach((element) => element.classList.remove(CLASS));

/**
 * 제안 카드에 마우스를 올리거나 초점을 두면 그 카드가 바꿀 행이나 질문에 테두리를 두른다.
 * 금액과 판정은 미리 보이지 않는다. 화면이 바뀌면 지운다
 */
export function Highlighter() {
  const { pathname } = useLocation();

  useEffect(() => {
    const unsubscribe = highlightBus.subscribe((refs) => {
      clear();
      if (!refs || refs.length === 0) return;
      const wanted = new Set(refs);
      document.querySelectorAll<HTMLElement>(`[${REF_ATTR}]`).forEach((element) => {
        const own = (element.getAttribute(REF_ATTR) ?? '').split(/\s+/);
        if (own.some((ref) => wanted.has(ref))) element.classList.add(CLASS);
      });
    });
    return () => {
      unsubscribe();
      clear();
    };
  }, []);

  useEffect(() => clear, [pathname]);

  return null;
}
