'use client';

import { forwardRef } from 'react';

export type CaptionProps = React.HTMLAttributes<HTMLParagraphElement>;

const captionClasses =
  'font-serif text-cozy-caption text-cozy-textSecondary italic';

export const Caption = forwardRef<HTMLParagraphElement, CaptionProps>(
  function Caption({ className = '', ...rest }, ref) {
    return (
      <p
        ref={ref}
        className={`${captionClasses} ${className}`.trim()}
        {...rest}
      />
    );
  }
);
