'use client';

import React, { useState, useCallback } from 'react';
import { AnimationControls } from './AnimationControls';
import { AnimationProgress } from './AnimationProgress';
import { VideoPlayer } from './VideoPlayer';
import { useAnimationStatus } from '../hooks/useAnimationStatus';
import { AnimationError } from '../types/animation';

interface AnimationPanelProps {
  jobId: string;
  restoreId?: string;
  className?: string;
}

/**
 * AnimationPanel Component
 *
 * A combined panel that provides the full animation workflow:
 * 1. Controls for initiating animation (prompt + resolution)
 * 2. Progress display during generation
 * 3. Video player when complete
 * 4. Error handling with retry capability
 */
export const AnimationPanel: React.FC<AnimationPanelProps> = ({
  jobId,
  restoreId,
  className = '',
}) => {
  // Local state for current animation attempt
  const [currentAnimationId, setCurrentAnimationId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<AnimationError | null>(null);

  // Track animation status via SSE
  const { status, resultUrl, error: statusError } = useAnimationStatus(
    jobId,
    currentAnimationId,
    {
      onCompleted: (url) => {
        console.log('Animation completed with URL:', url);
      },
      onError: (err) => {
        console.log('Animation failed:', err);
        setLocalError(err);
      },
    }
  );

  // Combined error from local state or status hook
  const error = localError || statusError;

  // Handle animation started
  const handleAnimationStarted = useCallback((animationId: string) => {
    console.log('Animation started:', animationId);
    setCurrentAnimationId(animationId);
    setLocalError(null);
  }, []);

  // Handle error from controls
  const handleError = useCallback((err: AnimationError) => {
    console.error('Animation error:', err);
    setLocalError(err);
  }, []);

  // Handle retry
  const handleRetry = useCallback(() => {
    setCurrentAnimationId(null);
    setLocalError(null);
  }, []);

  // Determine what to show based on state
  const isAnimating = currentAnimationId && (status === 'pending' || status === 'processing');
  const isComplete = currentAnimationId && status === 'completed' && resultUrl;
  const isFailed = currentAnimationId && status === 'failed';
  const showControls = !currentAnimationId || isFailed;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Animation Progress (when animating) */}
      {isAnimating && (
        <AnimationProgress
          animationId={currentAnimationId}
          status={status}
          error={null}
          onRetry={handleRetry}
        />
      )}

      {/* Video Player (when complete) */}
      {isComplete && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900 flex items-center">
            <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Animation Ready
          </h4>
          <VideoPlayer
            videoUrl={resultUrl}
            autoPlay
            loop
            className="w-full aspect-video"
          />
          {/* Option to create another animation */}
          <button
            onClick={handleRetry}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Create Another Animation
          </button>
        </div>
      )}

      {/* Error State (when failed) */}
      {isFailed && (
        <AnimationProgress
          animationId={currentAnimationId}
          status="failed"
          error={error}
          onRetry={handleRetry}
        />
      )}

      {/* Animation Controls (when ready for new animation) */}
      {showControls && (
        <AnimationControls
          jobId={jobId}
          restoreId={restoreId}
          onAnimationStarted={handleAnimationStarted}
          onError={handleError}
          disabled={isAnimating}
        />
      )}
    </div>
  );
};

export default AnimationPanel;
