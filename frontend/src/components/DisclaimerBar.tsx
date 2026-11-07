import { useState } from 'react';
import { XIcon } from 'lucide-react';
import { DISCLAIMER } from '../copy';

/** 이 브라우저에서 고지 띠를 닫았는가. 닫은 뒤에도 같은 문장이 꼬리말에 남는다 */
const DISMISSED = 'preet.disclaimer.dismissed';

const dismissed = () => {
  try {
    return window.localStorage.getItem(DISMISSED) === '1';
  } catch {
    // 저장소를 막아 둔 브라우저. 닫아도 다음에 또 뜬다
    return false;
  }
};

/**
 * 앱 화면 위의 고지 띠. 세무대리로 오인될 소지를 화면에서 차단한다.
 * 한 번 읽은 사람에게는 자리만 차지해 닫을 수 있게 하고, 닫은 것은 브라우저에 남긴다.
 * 닫아도 앱 꼬리말에 같은 문장이 남는다. 문장은 copy.ts 한 곳에 둔다. 띠를 칠하지 않고 괘선으로만 가른다
 */
export function DisclaimerBar() {
  const [hidden, setHidden] = useState(dismissed);
  if (hidden) return null;

  const close = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(DISMISSED, '1');
    } catch {
      // 못 남기면 다음 화면에서 다시 뜬다
    }
  };

  return (
    <div className="border-b border-line print:hidden">
      <div className="mx-auto flex max-w-page items-center gap-3 px-6 py-1.5">
        <p className="min-w-0 flex-1 text-caption text-ink2 [word-break:keep-all]">{DISCLAIMER}</p>
        <button
          type="button"
          onClick={close}
          aria-label="고지 닫기"
          className="-mr-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink2 transition-colors duration-150 ease-snap hover:bg-surface hover:text-ink">
          <XIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>);

}
