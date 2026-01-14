/**
 * Animation Service
 *
 * Service for creating and managing image-to-video animations using Replicate.
 * Uses the authenticated apiClient for all API requests.
 */

import { apiClient } from './apiClient';
import {
  CreateAnimationRequest,
  AnimationAttemptResponse,
  AnimationResolution,
  PROMPT_MIN_LENGTH,
  PROMPT_MAX_LENGTH,
  DEFAULT_RESOLUTION,
} from '../types/animation';

/**
 * Validate animation prompt
 */
export function validatePrompt(prompt: string): { valid: boolean; error?: string } {
  const trimmed = prompt.trim();

  if (trimmed.length < PROMPT_MIN_LENGTH) {
    return { valid: false, error: 'Please enter a prompt describing the animation' };
  }

  if (trimmed.length > PROMPT_MAX_LENGTH) {
    return { valid: false, error: `Prompt must be ${PROMPT_MAX_LENGTH} characters or less` };
  }

  return { valid: true };
}

/**
 * Validate resolution value
 */
export function validateResolution(resolution: string): resolution is AnimationResolution {
  return ['480p', '720p', '1080p'].includes(resolution);
}

/**
 * Animation Service class
 */
export class AnimationService {
  /**
   * Create an animation from a photo or restore result
   *
   * @param jobId - The job ID containing the source image
   * @param prompt - Text description for video generation (1-500 chars)
   * @param options - Optional parameters (restoreId, resolution)
   * @returns The created animation attempt
   */
  async createAnimation(
    jobId: string,
    prompt: string,
    options?: {
      restoreId?: string;
      resolution?: AnimationResolution;
    }
  ): Promise<AnimationAttemptResponse> {
    // Validate prompt
    const promptValidation = validatePrompt(prompt);
    if (!promptValidation.valid) {
      throw new Error(promptValidation.error);
    }

    // Validate resolution if provided
    const resolution = options?.resolution || DEFAULT_RESOLUTION;
    if (!validateResolution(resolution)) {
      throw new Error('Invalid resolution. Must be 480p, 720p, or 1080p');
    }

    // Build request body
    const requestBody: CreateAnimationRequest = {
      params: {
        prompt: prompt.trim(),
        resolution,
      },
    };

    // Add restore_id if animating a restored photo
    if (options?.restoreId) {
      requestBody.restore_id = options.restoreId;
    }

    // Make API request
    const response = await apiClient.post<AnimationAttemptResponse>(
      `/v1/jobs/${jobId}/animate`,
      requestBody
    );

    return response;
  }

  /**
   * Get animation details by job ID
   * Returns the job with animation attempt information
   */
  async getAnimationStatus(jobId: string): Promise<{
    latestAnimationId?: string;
    animationAttempts: AnimationAttemptResponse[];
  }> {
    interface JobResponse {
      id: string;
      latest_animation_id?: string;
      animation_attempts?: AnimationAttemptResponse[];
    }

    const response = await apiClient.get<JobResponse>(`/v1/jobs/${jobId}`);

    return {
      latestAnimationId: response.latest_animation_id,
      animationAttempts: response.animation_attempts || [],
    };
  }

  /**
   * Get presigned URL for an animation video
   * Returns the video URL from the animation attempt
   */
  async getAnimationVideoUrl(
    jobId: string,
    animationId: string
  ): Promise<string | null> {
    const status = await this.getAnimationStatus(jobId);
    const animation = status.animationAttempts.find(a => a.id === animationId);

    return animation?.result_url || null;
  }
}

// Export singleton instance
export const animationService = new AnimationService();
