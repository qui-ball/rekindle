/**
 * Animation Types
 * Type definitions for image-to-video animation feature using Replicate
 */

// Animation resolution options
export type AnimationResolution = '480p' | '720p' | '1080p';

// Animation status states
export type AnimationStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Animation parameters for API requests
export interface AnimationParams {
  prompt: string;           // Required: text description for video generation (1-500 chars)
  resolution?: AnimationResolution;  // Optional: defaults to 720p
}

// Request to create an animation
export interface CreateAnimationRequest {
  restore_id?: string;      // Optional: if not provided, uses original photo
  model?: string;           // Optional: defaults to "replicate_wan"
  params: AnimationParams;
}

// Animation attempt response from backend
export interface AnimationAttemptResponse {
  id: string;
  job_id: string;
  restore_id?: string;
  preview_s3_key: string;
  result_s3_key?: string;
  thumb_s3_key?: string;
  model?: string;
  params?: Record<string, unknown>;
  created_at: string;
  preview_url?: string;
  result_url?: string;
  thumb_url?: string;
}

// Animation status for polling/SSE updates
export interface AnimationStatusEvent {
  animation_id: string;
  job_id: string;
  status: AnimationStatus;
  result_url?: string;
  error?: string;
}

// Animation error information
export interface AnimationError {
  message: string;
  code?: string;
  retryable: boolean;
}

// Component state for animation controls
export interface AnimationControlsState {
  prompt: string;
  resolution: AnimationResolution;
  isSubmitting: boolean;
  error: AnimationError | null;
}

// Component state for animation progress
export interface AnimationProgressState {
  status: AnimationStatus;
  animationId: string | null;
  resultUrl: string | null;
  error: AnimationError | null;
}

// Props for AnimationControls component
export interface AnimationControlsProps {
  photoId: string;
  restoreId?: string;
  onAnimationStarted: (animationId: string) => void;
  onError: (error: AnimationError) => void;
  disabled?: boolean;
}

// Props for AnimationProgress component
export interface AnimationProgressProps {
  animationId: string | null;
  status: AnimationStatus;
  error: AnimationError | null;
  onRetry: () => void;
}

// Props for VideoPlayer component
export interface VideoPlayerProps {
  videoUrl: string;
  onDownload?: () => void;
  autoPlay?: boolean;
  loop?: boolean;
  className?: string;
}

// Resolution display information
export interface ResolutionOption {
  value: AnimationResolution;
  label: string;
  description: string;
}

// Default resolution options for UI
export const RESOLUTION_OPTIONS: ResolutionOption[] = [
  { value: '480p', label: '480p', description: 'Faster processing, smaller file' },
  { value: '720p', label: '720p (Recommended)', description: 'Balanced quality and speed' },
  { value: '1080p', label: '1080p', description: 'Highest quality, longer processing' },
];

// Validation constants
export const PROMPT_MIN_LENGTH = 1;
export const PROMPT_MAX_LENGTH = 500;
export const DEFAULT_RESOLUTION: AnimationResolution = '720p';
