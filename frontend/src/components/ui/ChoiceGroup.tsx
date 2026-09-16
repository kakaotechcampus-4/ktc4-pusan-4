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

/** 단일 선택 버튼 묶음. 문진·질문 응답처럼 선택지가 3~6개일 때 쓴다. */
export function ChoiceGroup<T extends string | boolean>({
  name,
  options,
  value,
  onChange,
  columns = 3,
  className
}: ChoiceGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={cn('grid gap-2', COLUMNS[columns], className)}>
      
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={option.disabled || undefined}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-xl border px-3.5 py-3 text-left transition-colors duration-150 ease-snap',
              selected ?
              'border-accent bg-accent-soft' :
              'border-line bg-surface hover:bg-canvas',
              option.disabled &&
              'cursor-not-allowed border-dashed bg-canvas opacity-60 hover:bg-canvas'
            )}>
            
            <span className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  'block text-small font-semibold',
                  selected ? 'text-accent' : 'text-ink'
                )}>
                
                {option.label}
              </span>
              {option.disabled &&
              <span className="shrink-0 rounded-md bg-line2 px-1.5 py-0.5 text-caption font-medium text-muted">
                  {option.disabledLabel ?? '준비 중'}
                </span>
              }
            </span>
            {option.hint &&
            <span className="mt-0.5 block text-caption text-muted">
                {option.hint}
              </span>
            }
          </button>);

      })}
    </div>);

}
