'use client';

import { forwardRef } from 'react';

export type TaglineProps = React.HTMLAttributes<HTMLParagraphElement>;

const taglineClasses =
  'font-serif text-cozy-tagline text-cozy-accent italic';

export const Tagline = forwardRef<HTMLParagraphElement, TaglineProps>(
  function Tagline({ className = '', ...rest }, ref) {
    return (
      <p
        ref={ref}
        className={`${taglineClasses} ${className}`.trim()}
        {...rest}
      />
    );
  }
);
