import React from 'react';
import { cn } from './cn';

type CardTone = 'surface' | 'canvas' | 'ink';
type CardPadding = 'sm' | 'md' | 'lg' | 'none';

const TONE: Record<CardTone, string> = {
  surface: 'border border-line bg-surface',
  canvas: 'border border-line bg-canvas',
  ink: 'bg-ink text-white'
};

const PADDING: Record<CardPadding, string> = {
  none: '',
  sm: 'p-6',
  md: 'p-7',
  lg: 'p-8 lg:p-10'
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
