'use client';

import { createElement, forwardRef } from 'react';

export type HeadlineLevel = 1 | 2 | 3;
export type HeadlineAs = 'h1' | 'h2' | 'h3' | 'h4';

export interface HeadlineProps extends Omit<React.HTMLAttributes<HTMLHeadingElement>, 'color'> {
  /** Visual level (H1–H3); drives size/weight from theme tokens. */
  level?: HeadlineLevel;
  /** Semantic element. Defaults to level (1→h1, 2→h2, 3→h3). Override for accessibility when needed. */
  as?: HeadlineAs;
}

const levelClasses: Record<HeadlineLevel, string> = {
  1: 'font-serif font-normal text-cozy-h1 text-cozy-heading',
  2: 'font-serif font-normal text-cozy-h2 text-cozy-heading',
  3: 'font-serif font-normal text-cozy-h3 text-cozy-heading',
};

export const Headline = forwardRef<HTMLHeadingElement, HeadlineProps>(
  function Headline(
    { level = 1, as, className = '', children, ...rest },
    ref
  ) {
    const Component = as ?? (`h${level}` as HeadlineAs);
    const classes = levelClasses[level];
    return createElement(
      Component,
      {
        ref,
        className: `${classes} ${className}`.trim(),
        ...rest,
      },
      children
    );
  }
);
