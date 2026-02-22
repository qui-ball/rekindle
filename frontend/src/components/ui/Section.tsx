'use client';

import { forwardRef } from 'react';

export type SectionVariant = 'default' | 'hero' | 'cta';

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  /** Visual variant: default (py-cozy-section), hero (larger vertical rhythm), cta (same as default). */
  variant?: SectionVariant;
  /** Semantic element. Default: 'section'. */
  as?: 'section' | 'div' | 'article';
}

const variantClasses: Record<SectionVariant, string> = {
  default: 'py-cozy-section',
  hero: 'py-16 cozy-tablet:py-24',
  cta: 'py-cozy-section',
};

export const Section = forwardRef<HTMLElement, SectionProps>(
  function Section(
    { variant = 'default', as: Component = 'section', className = '', ...rest },
    ref
  ) {
    const variantClass = variantClasses[variant];
    return (
      <Component
        ref={ref as React.Ref<HTMLDivElement>}
        className={`${variantClass} ${className}`.trim()}
        {...rest}
      />
    );
  }
);
