import React from 'react';
import { cn } from './cn';

export interface FilterOption<V extends string> {
  value: V;
  label: React.ReactNode;
  /** 선택지 옆 건수 */
  count?: number;
}

interface FilterBarProps<V extends string> {
  /** 접근성용 묶음 이름 */
  name: string;
  options: FilterOption<V>[];
  value: V;
  onChange: (value: V) => void;
  className?: string;
}

/**
 * 목록 위 한 줄 필터. 선택지가 5개 안쪽이고 서로 배타적일 때 쓴다.
 * 그보다 많거나 여러 축을 동시에 걸어야 하면 Select 를 쓴다.
 * role=tablist 가 아니라 aria-pressed 버튼 묶음이다 — tabpanel 이 따로 없고
 * 같은 목록을 걸러내기만 하므로 탭의 키보드 규약(화살표 이동)이 맞지 않는다.
 */
export function FilterBar<V extends string>({
  name,
  options,
  value,
  onChange,
  className
}: FilterBarProps<V>) {
  return (
    <div
      role="group"
      aria-label={name}
      className={cn('flex flex-wrap items-center gap-1', className)}>

      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-small font-semibold transition-colors duration-150 ease-snap',
              active ? 'bg-ink text-white' : 'text-ink2 hover:bg-canvas'
            )}>

            {option.label}
            {option.count !== undefined &&
            <span className="ml-1.5 tabular-nums opacity-70">
                {option.count.toLocaleString('ko-KR')}
              </span>
            }
          </button>);

      })}
    </div>);

}
