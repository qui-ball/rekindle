/**
 * Hook to track animation status via SSE (Server-Sent Events)
 *
 * Listens for animation completion/failure events and updates state accordingly.
 * Uses the existing SSE infrastructure from the backend.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { AnimationStatus, AnimationError } from '../types/animation';
import { animationService } from '../services/animationService';

interface AnimationStatusEvent {
  animation_id: string;
  job_id: string;
  status: 'completed' | 'failed';
  result_url?: string;
  error?: string;
}

interface UseAnimationStatusOptions {
  onCompleted?: (resultUrl: string) => void;
  onError?: (error: AnimationError) => void;
}

interface UseAnimationStatusReturn {
  status: AnimationStatus;
  resultUrl: string | null;
  error: AnimationError | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook to monitor animation status
 *
 * @param jobId - The job ID to monitor
 * @param animationId - The specific animation attempt ID (optional, uses latest if not provided)
 * @param options - Callbacks for completion and error events
 */
export function useAnimationStatus(
  jobId: string | null,
  animationId: string | null,
  options: UseAnimationStatusOptions = {}
): UseAnimationStatusReturn {
  const [status, setStatus] = useState<AnimationStatus>('pending');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<AnimationError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const callbacksRef = useRef(options);

  // Keep callbacks ref up to date
  useEffect(() => {
    callbacksRef.current = options;
  }, [options]);

  // Fetch current animation status from API
  const fetchStatus = useCallback(async () => {
    if (!jobId) return;

    setIsLoading(true);
    try {
      const data = await animationService.getAnimationStatus(jobId);
      const targetAnimationId = animationId || data.latestAnimationId;

      if (!targetAnimationId) {
        setStatus('pending');
        return;
      }

      // Find the specific animation
      const animation = data.animationAttempts.find(
        (a) => a.id === targetAnimationId
      );

      if (!animation) {
        setStatus('pending');
        return;
      }

      // Determine status from animation data
      if (animation.result_url) {
        setStatus('completed');
        setResultUrl(animation.result_url);
        setError(null);
      } else if (animation.preview_s3_key === 'failed') {
        setStatus('failed');
        const errorMessage =
          (animation.params as Record<string, unknown>)?.error_message as string ||
          'Animation generation failed';
        setError({ message: errorMessage, retryable: true });
      } else {
        setStatus('processing');
      }
    } catch (err) {
      console.error('Error fetching animation status:', err);
      // Don't update status on fetch error - keep current state
    } finally {
      setIsLoading(false);
    }
  }, [jobId, animationId]);

  // Set up SSE listener for real-time updates
  useEffect(() => {
    if (!jobId || !animationId) return;

    // SSE endpoint - direct backend URL for SSE to work properly
    // TODO: Use environment variable for production
    const sseUrl = `http://localhost:8000/api/v1/events/${jobId}`;
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    // Listen for animation_completed events
    eventSource.addEventListener('animation_completed', (event) => {
      const data: AnimationStatusEvent = JSON.parse(event.data);
      console.log('Animation completed via SSE:', data);

      // Only update if this is for our animation
      if (data.animation_id === animationId) {
        setStatus('completed');
        setResultUrl(data.result_url || null);
        setError(null);

        if (data.result_url && callbacksRef.current.onCompleted) {
          callbacksRef.current.onCompleted(data.result_url);
        }
      }
    });

    // Listen for animation_failed events
    eventSource.addEventListener('animation_failed', (event) => {
      const data: AnimationStatusEvent = JSON.parse(event.data);
      console.log('Animation failed via SSE:', data);

      // Only update if this is for our animation
      if (data.animation_id === animationId) {
        const animationError: AnimationError = {
          message: data.error || 'Animation generation failed',
          retryable: true,
        };
        setStatus('failed');
        setError(animationError);
        setResultUrl(null);

        if (callbacksRef.current.onError) {
          callbacksRef.current.onError(animationError);
        }
      }
    });

    // Handle connection errors
    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      // Don't close - EventSource will auto-reconnect
    };

    // Cleanup on unmount or when IDs change
    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [jobId, animationId]);

  // Initial fetch on mount and when IDs change
  useEffect(() => {
    if (jobId && animationId) {
      fetchStatus();
    }
  }, [jobId, animationId, fetchStatus]);

  // Polling fallback - check every 30 seconds if still processing
  useEffect(() => {
    if (!jobId || !animationId || status !== 'processing') return;

    const pollInterval = setInterval(() => {
      fetchStatus();
    }, 30000);

    return () => clearInterval(pollInterval);
  }, [jobId, animationId, status, fetchStatus]);

  return {
    status,
    resultUrl,
    error,
    isLoading,
    refresh: fetchStatus,
  };
}

export default useAnimationStatus;
