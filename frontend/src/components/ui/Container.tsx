'use client';

import { forwardRef } from 'react';

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Apply vertical padding from theme (py-cozy-section). Default: false. */
  verticalPadding?: boolean;
}

const containerBaseClasses =
  'w-full max-w-cozy-container mx-auto px-cozy-container-mobile cozy-mobile:px-cozy-container-tablet cozy-tablet:px-cozy-container';

export const Container = forwardRef<HTMLDivElement, ContainerProps>(
  function Container({ verticalPadding = false, className = '', ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={`${containerBaseClasses} ${verticalPadding ? 'py-cozy-section' : ''} ${className}`.trim()}
        {...rest}
      />
    );
  }
);
