'use client';

import { forwardRef } from 'react';

export interface BodyProps extends React.HTMLAttributes<HTMLParagraphElement> {
  /** Render as italic (e.g. for hero/subtitle text). */
  italic?: boolean;
}

const bodyBaseClasses =
  'font-serif text-cozy-body text-cozy-textSecondary leading-cozy';

export const Body = forwardRef<HTMLParagraphElement, BodyProps>(
  function Body({ italic = false, className = '', ...rest }, ref) {
    return (
      <p
        ref={ref}
        className={`${bodyBaseClasses} ${italic ? 'italic' : ''} ${className}`.trim()}
        {...rest}
      />
    );
  }
);
