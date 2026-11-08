import { useRef } from 'react';
import { cn } from './cn';

export interface ChoiceOption<T extends string | boolean> {
  value: T;
  label: string;
  hint?: string;
  /**
   * 있지만 아직 동작하지 않는 선택지. 흐리게 보이고 눌리지 않으며 '준비 중'이 붙는다.
   * 눌리는데 아무 일도 없는 버튼은 만들지 않는다 (DESIGN.md).
   */
  disabled?: boolean;
  /** disabled 일 때 '준비 중' 대신 보여줄 문구 */
  disabledLabel?: string;
}

interface ChoiceGroupProps<T extends string | boolean> {
  name: string;
  options: ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 한 줄에 놓을 개수 (sm 이상). 기본 3 */
  columns?: 2 | 3 | 4;
  className?: string;
}

const COLUMNS = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4'
} as const;

/**
 * 단일 선택 버튼 묶음. 문진·질문 응답처럼 선택지가 3~6개일 때 쓴다.
 * 고르지 않은 칸은 흰 바탕에 edge 테두리, 고른 칸은 accent 테두리와 accent-soft 바탕이다.
 * 고른 칸의 글자는 accent-hover 다. accent 는 accent-soft 위에서 4.11 이라 13px 글자에 모자란다
 */
export function ChoiceGroup<T extends string | boolean>({
  name,
  options,
  value,
  onChange,
  columns = 3,
  className
}: ChoiceGroupProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.flatMap((option, index) => option.disabled ? [] : [index]);
  /*
   * 라디오 묶음처럼 Tab 은 한 번만 선다. 고른 칸에, 아직 안 골랐으면 첫 칸에 선다.
   * 칸 사이는 화살표로 옮기고 옮기면 바로 고른다 (WAI-ARIA radio group)
   */
  const selectedIndex = options.findIndex((option) => option.value === value && !option.disabled);
  const tabStop = selectedIndex >= 0 ? selectedIndex : enabled[0];

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const edge = { Home: enabled[0], End: enabled[enabled.length - 1] }[event.key];
    const at = enabled.indexOf(index);
    const next = edge ?? (step === undefined ? undefined : enabled[(at + step + enabled.length) % enabled.length]);
    if (next === undefined) return;
    event.preventDefault();
    buttons.current[next]?.focus();
    onChange(options[next].value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={cn('grid gap-2', COLUMNS[columns], className)}>

      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            ref={(el) => {
              buttons.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={option.disabled || undefined}
            disabled={option.disabled}
            tabIndex={index === tabStop ? 0 : -1}
            onKeyDown={(event) => onKeyDown(event, index)}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-xl border px-3.5 py-3 text-left transition-colors duration-150 ease-snap',
              selected ?
              'border-accent bg-accent-soft' :
              option.disabled ?
              'cursor-not-allowed border-dashed border-edge bg-canvas opacity-60' :
              'border-edge bg-canvas hover:bg-surface'
            )}>

            <span className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  'block text-small font-bold',
                  selected ? 'text-accent-hover' : 'text-ink'
                )}>

                {option.label}
              </span>
              {option.disabled &&
              <span className="shrink-0 rounded-md bg-line2 px-1.5 py-0.5 text-caption font-normal text-muted">
                  {option.disabledLabel ?? '준비 중'}
                </span>
              }
            </span>
            {option.hint &&
            <span className="mt-0.5 block text-caption text-ink2">
                {option.hint}
              </span>
            }
          </button>);

      })}
    </div>);

}
