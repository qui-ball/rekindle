/**
 * Hook to listen for SSE (Server-Sent Events) updates on a job
 * Automatically triggers UI re-render when job completes
 */

import { useEffect, useRef } from 'react';

interface JobCompletedEvent {
  job_id: string;
  restore_id: string;
  status: string;
}

interface UseJobEventsOptions {
  onCompleted?: (data: JobCompletedEvent) => void;
}

export function useJobEvents(jobId: string | null, options: UseJobEventsOptions = {}) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const callbackRef = useRef(options.onCompleted);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = options.onCompleted;
  }, [options.onCompleted]);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    // Connect to SSE endpoint - MUST use direct backend URL for SSE to work
    // Next.js proxy doesn't handle SSE streaming properly
    // TODO: Use environment variable for production: process.env.NEXT_PUBLIC_BACKEND_URL
    const sseUrl = `http://localhost:8000/api/v1/events/${jobId}`;
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    // Listen for 'completed' events
    eventSource.addEventListener('completed', (event) => {
      const data: JobCompletedEvent = JSON.parse(event.data);
      console.log('Job completed via SSE:', data);

      // Trigger callback if provided
      if (callbackRef.current) {
        callbackRef.current(data);
      }
    });

    // Handle connection errors (auto-reconnects)
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      console.error('EventSource readyState:', eventSource.readyState);
    };

    // Cleanup on unmount or job change
    return () => {
      eventSource.close();
    };
  }, [jobId]); // Only depend on jobId, not the callback

  return null;
}

