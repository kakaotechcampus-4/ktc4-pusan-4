import { useRef, useState } from 'react';
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
  /** 있으면 고른 칸을 다시 눌러 고른 것을 거둔다(판정, 질문). 없으면 다시 눌러도 그대로다 */
  onClear?: () => void;
  /**
   * 화살표로 옮길 때 바로 고르는지. 기본은 고른다(라디오 묶음 관례).
   * 고르는 순간 서버에 저장하는 곳(질문 답)은 끈다. 화살표는 초점만 옮기고 Space, Enter 로 고른다
   */
  selectOnFocus?: boolean;
  /** 고르지 않아 저장을 막았다. 칸 테두리를 빨갛게 하고 오류 문구(describedBy)를 잇는다 */
  invalid?: boolean;
  describedBy?: string;
  /** 한 줄에 놓을 개수 (sm 이상). 기본 3 */
  columns?: 2 | 3 | 4;
  className?: string;
  /**
   * 묶음 안에 초점이 있을 때 숫자 1~9 로 n번째 선택지를 고른다(질문 화면). 키보드로 들어오면 선택지에 번호가 뜬다.
   * 이미 고른 칸의 번호를 다시 눌러도 거두지 않는다
   */
  numberKeys?: boolean;
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
  onClear,
  selectOnFocus = true,
  invalid = false,
  describedBy,
  columns = 3,
  className,
  numberKeys = false
}: ChoiceGroupProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.flatMap((option, index) => option.disabled ? [] : [index]);
  /*
   * 라디오 묶음처럼 Tab 은 한 번만 선다. 고른 칸에, 아직 안 골랐으면 첫 칸에 선다.
   * 칸 사이는 화살표로 옮기고 옮기면 바로 고른다 (WAI-ARIA radio group)
   */
  const selectedIndex = options.findIndex((option) => option.value === value && !option.disabled);
  /**
   * 고르지 않고 초점만 옮긴 칸(selectOnFocus 를 끈 묶음). Tab 은 지금 초점이 있는 칸에 서야
   * Shift+Tab 한 번에 묶음을 벗어난다. 묶음을 벗어나면 다시 고른 칸으로 돌아간다
   */
  const [focused, setFocused] = useState<number | null>(null);
  /**
   * 화살표로 막 고른 칸. 거기서 Space, Enter 를 누르면 버튼의 click 이 한 번 더 온다.
   * 그 click 은 고른 것을 거두는 게 아니라 고른 것을 확정하는 누름이다
   */
  const arrowPicked = useRef<number | null>(null);
  const tabStop = !selectOnFocus && focused !== null ? focused : selectedIndex >= 0 ? selectedIndex : enabled[0];

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    // Alt+← 같은 브라우저 단축키는 그대로 둔다
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (numberKeys && /^[1-9]$/.test(event.key)) {
      const picked = Number(event.key) - 1;
      const option = options[picked];
      if (!option || option.disabled) return;
      event.preventDefault();
      buttons.current[picked]?.focus();
      if (option.value !== value) onChange(option.value);
      return;
    }
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const edge = { Home: enabled[0], End: enabled[enabled.length - 1] }[event.key];
    const at = enabled.indexOf(index);
    const next = edge ?? (step === undefined ? undefined : enabled[(at + step + enabled.length) % enabled.length]);
    if (next === undefined) return;
    event.preventDefault();
    buttons.current[next]?.focus();
    if (selectOnFocus) {
      arrowPicked.current = next;
      onChange(options[next].value);
    } else
    setFocused(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label={name}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setFocused(null);
        // 묶음을 떠났으면 화살표로 고른 것은 확정된 것이다. 다음 누름은 거두기다
        arrowPicked.current = null;
      }}
      className={cn('group/choices grid gap-2', COLUMNS[columns], className)}>

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
            onClick={() => {
              const confirming = arrowPicked.current === index;
              arrowPicked.current = null;
              if (selected && onClear && !confirming) onClear();else
              onChange(option.value);
            }}
            className={cn(
              'rounded-xl border px-3.5 py-3 text-left transition-colors duration-150 ease-snap',
              selected ?
              'border-accent bg-accent-soft' :
              option.disabled ?
              'cursor-not-allowed border-dashed border-accent-line bg-canvas opacity-60' :
              invalid ?
              'border-deny bg-canvas hover:bg-surface' :
              'border-accent-line bg-canvas hover:border-ink hover:bg-surface'
            )}>

            <span className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  'block text-small font-bold',
                  selected ? 'text-accent-hover' : 'text-ink'
                )}>

                {/* 마우스로 고를 때는 숨기고, 키보드로 묶음에 들어오면 번호를 보인다 */}
                {numberKeys && index < 9 &&
                <span
                  aria-hidden="true"
                  className="mr-1.5 hidden h-4 w-4 items-center justify-center rounded border border-edge text-caption font-normal tabular-nums text-ink2 group-has-[:focus-visible]/choices:inline-flex">

                    {index + 1}
                  </span>
                }
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
