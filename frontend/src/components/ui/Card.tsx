import React from 'react';
import { cn } from './cn';

type CardTone = 'canvas' | 'ink';
type CardPadding = 'sm' | 'md' | 'lg' | 'none';

/**
 * 흰 상자에 옅은 테두리가 기본이다. 회색으로 칠하지 않는다 — 회색은 hover·고른 상태의 색이다.
 * 경계가 꼭 필요한 덩어리에만 쓰고, 나머지는 흰 바탕에 간격으로 가른다
 */
const TONE: Record<CardTone, string> = {
  canvas: 'border border-line bg-canvas',
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
  tone = 'canvas',
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
