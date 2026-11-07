import React from 'react';
import { cn } from './cn';

type HeadingLevel = 'h1' | 'h2' | 'h3';
/** page 는 로그인 뒤 화면의 머리(작은 accent eyebrow + 28px h1). lg·md·sm 은 공개 화면·랜딩 섹션 제목 */
type HeadingSize = 'page' | 'lg' | 'md' | 'sm';

/** 반응형 크기는 여기서만 정한다. page 는 흐름 화면(StepEyebrow + h1)과 같은 모양이다 (C88) */
const SIZE: Record<HeadingSize, string> = {
  page: 'text-h2',
  lg: 'text-h1 sm:text-h1-lg',
  md: 'text-h2 sm:text-h2-lg',
  sm: 'text-h3 sm:text-h3-lg'
};

interface SectionHeadingProps {
  /** 제목 위 작은 라벨 */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** 제목 아래 설명 문단. 없어도 되는 설명이면 넣지 않는다 */
  description?: React.ReactNode;
  /** 기본은 page 면 h1, 그 밖에는 h2 */
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
  as,
  size = 'md',
  inverse = false,
  className
}: SectionHeadingProps) {
  const page = size === 'page';
  const Tag = as ?? (page ? 'h1' : 'h2');
  return (
    <div className={className}>
      {eyebrow &&
      <p
        className={cn(
          'font-bold',
          page ? 'text-small' : 'text-body-lg',
          inverse ? 'text-white/60' : page ? 'text-accent' : 'text-ink2'
        )}>

          {eyebrow}
        </p>
      }
      <Tag
        className={cn(
          'font-bold tracking-tight',
          SIZE[size],
          Boolean(eyebrow) && (page ? 'mt-1.5' : 'mt-4'),
          inverse ? 'text-white' : 'text-ink'
        )}>

        {title}
      </Tag>
      {description &&
      <p
        className={cn(
          'max-w-2xl',
          page ? 'mt-2 text-body' : 'mt-4 text-body-lg',
          inverse ? 'text-white/60' : 'text-ink2'
        )}>

          {description}
        </p>
      }
    </div>);

}
