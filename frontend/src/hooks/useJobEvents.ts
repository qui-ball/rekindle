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
    if (!jobId) return;

    // Connect to SSE endpoint
    const eventSource = new EventSource(`/api/v1/events/${jobId}`);
    eventSourceRef.current = eventSource;

    // Listen for 'completed' events
    eventSource.addEventListener('completed', (event) => {
      const data: JobCompletedEvent = JSON.parse(event.data);
      console.log('✅ Job completed via SSE:', data);

      // Trigger callback if provided
      if (callbackRef.current) {
        callbackRef.current(data);
      }
    });

    // Handle connection errors (auto-reconnects)
    eventSource.onerror = (error) => {
      console.log('SSE connection error (will auto-reconnect)', error);
    };

    eventSource.onopen = () => {
      console.log(`📡 SSE connected for job ${jobId}`);
    };

    // Cleanup on unmount or job change
    return () => {
      console.log(`🔌 SSE disconnected for job ${jobId}`);
      eventSource.close();
    };
  }, [jobId]); // Only depend on jobId, not the callback

  return null;
}

