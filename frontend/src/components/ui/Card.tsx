'use client';

import { forwardRef } from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional left accent (border/bar). */
  accentLeft?: boolean;
  /** Enable hover lift (translateY + shadow transition); respects prefers-reduced-motion. */
  hover?: boolean;
}

const cardBaseClasses =
  'bg-cozy-surface border border-cozy-borderCard rounded-cozy-lg shadow-cozy-card focus:outline-none focus-visible:ring-2 focus-visible:ring-cozy-accent focus-visible:ring-offset-2 focus-visible:ring-offset-cozy-background focus-within:ring-2 focus-within:ring-cozy-accent focus-within:ring-offset-2 focus-within:ring-offset-cozy-background';

export const Card = forwardRef<HTMLDivElement, CardProps>(
  function Card(
    { accentLeft = false, hover = false, className = '', ...rest },
    ref
  ) {
    const accentClasses = accentLeft
      ? 'border-l-4 border-l-cozy-accent'
      : '';
    const hoverClasses = hover
      ? 'transition-[box-shadow,transform,border-color] duration-300 ease-out motion-reduce:transition-none motion-safe:hover:-translate-y-5 motion-safe:transition-transform hover:shadow-cozy-card-hover motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-cozy-card'
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
