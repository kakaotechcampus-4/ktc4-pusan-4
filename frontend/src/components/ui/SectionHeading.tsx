import React from 'react';
import { cn } from './cn';

type HeadingLevel = 'h1' | 'h2' | 'h3';
type HeadingSize = 'lg' | 'md' | 'sm';

/** 랜딩 섹션 제목. 반응형 크기는 여기서만 정한다. */
const SIZE: Record<HeadingSize, string> = {
  lg: 'text-h1 sm:text-h1-lg',
  md: 'text-h2 sm:text-h2-lg',
  sm: 'text-h3 sm:text-h3-lg'
};

interface SectionHeadingProps {
  /** 제목 위 작은 라벨 */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** 제목 아래 설명 문단 */
  description?: React.ReactNode;
  as?: HeadingLevel;
  size?: HeadingSize;
  /** 어두운 배경 위에서 쓸 때 */
  inverse?: boolean;
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  as: Tag = 'h2',
  size = 'md',
  inverse = false,
  className
}: SectionHeadingProps) {
  return (
    <div className={className}>
      {eyebrow &&
      <p
        className={cn(
          'text-body-lg font-semibold',
          inverse ? 'text-white/60' : 'text-accent'
        )}>
        
          {eyebrow}
        </p>
      }
      <Tag
        className={cn(
          'font-bold tracking-tight',
          SIZE[size],
          eyebrow ? 'mt-4' : undefined,
          inverse ? 'text-white' : 'text-ink'
        )}>
        
        {title}
      </Tag>
      {description &&
      <p
        className={cn(
          'mt-3 max-w-2xl text-body-lg',
          inverse ? 'text-white/60' : 'text-muted'
        )}>
        
          {description}
        </p>
      }
    </div>);

}
