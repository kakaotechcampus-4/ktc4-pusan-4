import React from 'react';
import { cn } from './cn';

type CardTone = 'surface' | 'canvas' | 'ink';
type CardPadding = 'sm' | 'md' | 'lg' | 'none';

/** 회색 패널이 기본이다. 테두리도 그림자도 쓰지 않고 바탕색으로만 가른다 */
const TONE: Record<CardTone, string> = {
  surface: 'bg-surface',
  canvas: 'border border-line bg-sheet',
  ink: 'bg-ink text-white'
};

const PADDING: Record<CardPadding, string> = {
  none: '',
  sm: 'p-7',
  md: 'p-8',
  lg: 'p-10 lg:p-12'
};

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  tone?: CardTone;
  padding?: CardPadding;
  /** 시맨틱 태그. 목록 항목이면 li, 독립 내용이면 article */
  as?: 'div' | 'article' | 'section' | 'li';
}

export function Card({
  tone = 'surface',
  padding = 'sm',
  as: Tag = 'div',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={cn('rounded-2xl', TONE[tone], PADDING[padding], className)}
      {...rest}>
      
      {children}
    </Tag>);

}
