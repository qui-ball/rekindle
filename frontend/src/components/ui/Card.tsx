'use client';

import { forwardRef } from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional left accent (border/bar). */
  accentLeft?: boolean;
  /** Enable hover lift (translateY + shadow transition); respects prefers-reduced-motion. */
  hover?: boolean;
}

const cardBaseClasses =
  'bg-cozy-surface border border-cozy-borderCard rounded-cozy-lg shadow-cozy-card';

export const Card = forwardRef<HTMLDivElement, CardProps>(
  function Card(
    { accentLeft = false, hover = false, className = '', ...rest },
    ref
  ) {
    const accentClasses = accentLeft
      ? 'border-l-4 border-l-cozy-accent'
      : '';
    const hoverClasses = hover
      ? 'transition-[box-shadow,transform,border-color] duration-300 ease-out motion-reduce:transition-none hover:shadow-cozy-card-hover hover:-translate-y-5 motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-cozy-card'
      : '';

    return (
      <div
        ref={ref}
        className={`${cardBaseClasses} ${accentClasses} ${hoverClasses} ${className}`.trim()}
        {...rest}
      />
    );
  }
);
