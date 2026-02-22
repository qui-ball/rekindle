'use client';

import { forwardRef } from 'react';
import Link from 'next/link';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'default' | 'large';

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  /** Visual variant: primary (gradient, pill, hover lift), secondary (outline), ghost. */
  variant?: ButtonVariant;
  /** Size: default or large (for CTA). */
  size?: ButtonSize;
  /** Full-width layout (e.g. on small breakpoints). */
  fullWidth?: boolean;
  /** When set, render as Next.js Link instead of button (preserves navigation). */
  href?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-br from-cozy-gradientButtonStart to-cozy-gradientButtonEnd text-white font-medium rounded-cozy-pill shadow-cozy-button transition-shadow duration-300 ease-out hover:shadow-cozy-button-hover motion-safe:hover:-translate-y-[3px] motion-safe:transition-transform motion-reduce:hover:translate-y-0 border-0',
  secondary:
    'bg-cozy-surface text-cozy-accentDark font-medium rounded-cozy-pill border-2 border-cozy-accent hover:bg-cozy-mount hover:border-cozy-accentDark transition-colors duration-200',
  ghost:
    'bg-transparent text-cozy-accentDark font-medium rounded-cozy-pill hover:bg-cozy-mount transition-colors duration-200 border-0',
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'text-cozy-button py-2 px-4',
  large: 'text-cozy-button py-4 px-8 text-lg',
};

const baseClasses =
  'inline-flex items-center justify-center font-serif focus:outline-none focus-visible:ring-2 focus-visible:ring-cozy-accent focus-visible:ring-offset-2 focus-visible:ring-offset-cozy-background disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'default',
      fullWidth = false,
      href,
      className = '',
      children,
      ...rest
    },
    ref
  ) {
    const widthClass = fullWidth ? 'w-full cozy-tablet:w-auto' : '';
    const classes = [
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      widthClass,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    if (href != null) {
      const { type, ...linkRest } = rest as React.ButtonHTMLAttributes<HTMLButtonElement> & {
        type?: React.ButtonHTMLAttributes<HTMLButtonElement>['type'];
      };
      return (
        <Link
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          className={classes}
          {...linkRest}
        >
          {children}
        </Link>
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type={(rest as React.ButtonHTMLAttributes<HTMLButtonElement>).type ?? 'button'}
        className={classes}
        {...rest}
      >
        {children}
      </button>
    );
  }
);
