import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { DEV_EXPENSES } from '../mock/marketing';
import { Badge, type BadgeTone } from './ui';

/** 랜딩의 지출 예시 카드. 판정 3분류를 색·기호와 함께 보여준다 */
const VERDICT: Record<
  (typeof DEV_EXPENSES)[number]['verdict'],
  {label: string; symbol: string; tone: BadgeTone; skin: string;}> =
{
  ok: { label: '가능', symbol: '✓', tone: 'ok', skin: 'border-ok-line bg-ok-bg' },
  ask: { label: '확인 필요', symbol: '?', tone: 'warn', skin: 'border-warn-line bg-warn-bg' },
  deny: { label: '불가', symbol: '✕', tone: 'deny', skin: 'border-deny-line bg-deny-bg' }
};

/**
 * 가로로 넘겨 보는 예시 카드.
 *
 * 스크롤 스냅으로 만든다. 폭을 재서 transform 으로 밀면 한 줄에 몇 장 보이는지를
 * 자바스크립트가 알아야 하는데, 그 값이 브레이크포인트마다 달라 어긋나기 쉽다.
 * 스냅은 브라우저가 폭을 알아서 맞추고 손가락·트랙패드로도 그대로 넘어간다.
 */
export function ExampleCarousel() {
  const track = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    // 소수점 폭 때문에 끝에서 1px 가 남는 일이 있다
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [sync]);

  const move = (direction: -1 | 1) => {
    const el = track.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const step = card ? card.offsetWidth + 16 : el.clientWidth;
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: direction * step, behavior: smooth ? 'smooth' : 'auto' });
  };

  return (
    <div className="relative">
      <ul
        ref={track}
        onScroll={sync}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

        {DEV_EXPENSES.map((item) => {
          const meta = VERDICT[item.verdict];
          return (
            <li
              key={item.kind}
              className={`flex min-h-[280px] w-[78%] shrink-0 snap-start flex-col justify-end rounded-2xl border p-7 sm:w-[46%] lg:w-[calc((100%-32px)/3)] ${
              meta.skin}`
              }>

              <Badge tone={meta.tone} symbol={meta.symbol} size="md" className="w-fit">
                {meta.label}
              </Badge>
              <strong className="mt-auto block pt-8 text-h3 font-bold leading-tight tracking-ir-sm text-ink [word-break:keep-all] lg:text-ir-panel">
                {item.kind}
              </strong>
              <p className="mt-2 text-body text-ink2">{item.examples}</p>
              <p className="mt-4 border-t border-ink/10 pt-4 text-small leading-6 text-ink2 [word-break:keep-all]">
                {item.point}
              </p>
            </li>);

        })}
      </ul>

      {/* 좌우 끝에 걸치는 동그란 버튼 */}
      <button
        type="button"
        aria-label="이전 예시"
        disabled={atStart}
        onClick={() => move(-1)}
        className="absolute -left-4 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-accent-line bg-canvas text-ink transition-opacity hover:border-ink disabled:pointer-events-none disabled:opacity-0 lg:flex">

        <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="다음 예시"
        disabled={atEnd}
        onClick={() => move(1)}
        className="absolute -right-4 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-accent-line bg-canvas text-ink transition-opacity hover:border-ink disabled:pointer-events-none disabled:opacity-0 lg:flex">

        <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>);

}
