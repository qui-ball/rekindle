'use client';

import { forwardRef } from 'react';

/**
 * Design of the inner frame (content area). Extend this union to add new mount styles.
 * - default: neutral surface, for general use (gallery tiles, upload preview)
 * - before: "before" placeholder gradient (e.g. faded photo)
 * - after: "after" placeholder gradient (e.g. restored result)
 */
export type PhotoMountDesign = 'default' | 'before' | 'after';

/** Common aspect ratios for the inner content area. */
export type PhotoMountAspectRatio = '1' | '3/4' | '4/3' | '16/9' | '4/5';

export interface PhotoMountProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Visual design of the inner frame. Use to change the mount look; add new values to
   * PhotoMountDesign and innerDesignClasses to support more designs.
   */
  design?: PhotoMountDesign;
  /** Aspect ratio of the inner content area. Omit for no ratio constraint. */
  aspectRatio?: PhotoMountAspectRatio;
}

const innerDesignClasses: Record<PhotoMountDesign, string> = {
  default:
    'bg-cozy-surface border border-cozy-border rounded relative flex items-center justify-center text-cozy-textSecondary text-cozy-caption',
  before:
    'bg-gradient-to-br from-cozy-gradientBeforeStart to-cozy-gradientBeforeEnd border border-cozy-border rounded relative flex items-center justify-center text-cozy-textSecondary text-cozy-caption',
  after:
    'bg-gradient-to-br from-cozy-gradientAfterStart to-cozy-gradientAfterEnd border border-cozy-accent rounded relative flex items-center justify-center text-cozy-textSecondary text-cozy-caption',
};

const aspectRatioClasses: Record<PhotoMountAspectRatio, string> = {
  '1': 'aspect-square',
  '3/4': 'aspect-[3/4]',
  '4/3': 'aspect-[4/3]',
  '16/9': 'aspect-video',
  '4/5': 'aspect-[4/5]',
};

const mountOuterClasses =
  'bg-cozy-mount p-4 cozy-tablet:p-6 rounded-cozy-input';

export const PhotoMount = forwardRef<HTMLDivElement, PhotoMountProps>(
  function PhotoMount(
    {
      design = 'default',
      aspectRatio,
      className = '',
      children,
      ...rest
    },
    ref
  ) {
    const innerClasses = [
      'w-full overflow-hidden',
      innerDesignClasses[design],
      aspectRatio ? aspectRatioClasses[aspectRatio] : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div
        ref={ref}
        className={`${mountOuterClasses} ${className}`.trim()}
        {...rest}
      >
        <div className={innerClasses}>{children}</div>
      </div>
    );
  }
);
