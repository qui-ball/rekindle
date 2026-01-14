'use client';

import React from 'react';
import { AnimationStatus, AnimationError } from '../types/animation';

interface AnimationProgressProps {
  animationId: string | null;
  status: AnimationStatus;
  error: AnimationError | null;
  onRetry: () => void;
  className?: string;
}

/**
 * AnimationProgress Component
 *
 * Displays the current status of an animation generation:
 * - Pending/Processing: Shows spinner with status message
 * - Completed: Shows success message
 * - Failed: Shows error message with retry button
 */
export const AnimationProgress: React.FC<AnimationProgressProps> = ({
  animationId,
  status,
  error,
  onRetry,
  className = '',
}) => {
  if (!animationId) {
    return null;
  }

  // Pending or Processing state
  if (status === 'pending' || status === 'processing') {
    return (
      <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center">
          {/* Animated spinner */}
          <div className="flex-shrink-0 mr-3">
            <svg
              className="animate-spin h-6 w-6 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>

          {/* Status message */}
          <div className="flex-1">
            <h4 className="text-sm font-medium text-blue-900">
              {status === 'pending' ? 'Animation Queued' : 'Generating Animation...'}
            </h4>
            <p className="text-xs text-blue-700 mt-1">
              {status === 'pending'
                ? 'Your animation is in the queue and will start soon.'
                : 'This usually takes 2-5 minutes. You can navigate away and come back.'}
            </p>
          </div>
        </div>

        {/* Progress indicator (indeterminate) */}
        <div className="mt-3 h-1 bg-blue-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full animate-pulse"
            style={{ width: '100%' }}
          />
        </div>

        {/* Animation ID for reference */}
        <p className="text-xs text-blue-500 mt-2 font-mono">
          ID: {animationId.slice(0, 8)}...
        </p>
      </div>
    );
  }

  // Completed state
  if (status === 'completed') {
    return (
      <div className={`bg-green-50 border border-green-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center">
          {/* Success icon */}
          <div className="flex-shrink-0 mr-3">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          {/* Success message */}
          <div className="flex-1">
            <h4 className="text-sm font-medium text-green-900">Animation Complete</h4>
            <p className="text-xs text-green-700 mt-1">
              Your video has been generated and is ready to view below.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Failed state
  if (status === 'failed') {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-start">
          {/* Error icon */}
          <div className="flex-shrink-0 mr-3">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          {/* Error message */}
          <div className="flex-1">
            <h4 className="text-sm font-medium text-red-900">Animation Failed</h4>
            <p className="text-xs text-red-700 mt-1">
              {error?.message || 'An error occurred while generating your animation.'}
            </p>

            {/* Retry button */}
            {error?.retryable !== false && (
              <button
                onClick={onRetry}
                className="mt-3 inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 transition-colors"
              >
                <svg
                  className="w-3.5 h-3.5 mr-1.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Try Again
              </button>
            )}
          </div>
        </div>

        {/* Animation ID for support */}
        <p className="text-xs text-red-400 mt-2 font-mono">
          ID: {animationId.slice(0, 8)}...
        </p>
      </div>
    );
  }

  return null;
};

export default AnimationProgress;
