import React from 'react';
import { cn } from './cn';

interface ContainerProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section';
}

/** 페이지 폭(1180px) + 좌우 여백. 모든 섹션은 이 안에 놓는다. */
export function Container({
  as: Tag = 'div',
  className,
  children,
  ...rest
}: ContainerProps) {
  return (
    <Tag className={cn('mx-auto w-full max-w-page px-6', className)} {...rest}>
      {children}
    </Tag>);

}
