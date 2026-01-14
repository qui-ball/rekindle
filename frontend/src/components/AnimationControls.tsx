'use client';

import React, { useState, useCallback } from 'react';
import {
  AnimationResolution,
  AnimationError,
  RESOLUTION_OPTIONS,
  DEFAULT_RESOLUTION,
  PROMPT_MAX_LENGTH,
} from '../types/animation';
import { animationService, validatePrompt } from '../services/animationService';

interface AnimationControlsProps {
  jobId: string;
  restoreId?: string;
  onAnimationStarted: (animationId: string) => void;
  onError: (error: AnimationError) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * AnimationControls Component
 *
 * Provides UI for initiating image-to-video animation with:
 * - Text prompt input (required)
 * - Resolution selection dropdown
 * - Generate button with loading state
 * - Error display and retry capability
 */
export const AnimationControls: React.FC<AnimationControlsProps> = ({
  jobId,
  restoreId,
  onAnimationStarted,
  onError,
  disabled = false,
  className = '',
}) => {
  const [prompt, setPrompt] = useState('');
  const [resolution, setResolution] = useState<AnimationResolution>(DEFAULT_RESOLUTION);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Handle prompt change with validation
  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setPrompt(value);

    // Clear validation error when user starts typing
    if (validationError) {
      setValidationError(null);
    }
  }, [validationError]);

  // Handle resolution change
  const handleResolutionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setResolution(e.target.value as AnimationResolution);
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate prompt
    const validation = validatePrompt(prompt);
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid prompt');
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);

    try {
      const animation = await animationService.createAnimation(jobId, prompt, {
        restoreId,
        resolution,
      });

      // Notify parent of successful animation start
      onAnimationStarted(animation.id);

      // Clear form on success
      setPrompt('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start animation';
      const animationError: AnimationError = {
        message: errorMessage,
        retryable: true,
      };
      onError(animationError);
    } finally {
      setIsSubmitting(false);
    }
  }, [jobId, prompt, resolution, restoreId, onAnimationStarted, onError]);

  const isDisabled = disabled || isSubmitting;
  const charCount = prompt.length;
  const isOverLimit = charCount > PROMPT_MAX_LENGTH;

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        Animate Photo
      </h4>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Prompt Input */}
        <div>
          <label htmlFor="animation-prompt" className="block text-xs font-medium text-gray-700 mb-1">
            Describe how you want the photo to move
          </label>
          <textarea
            id="animation-prompt"
            value={prompt}
            onChange={handlePromptChange}
            placeholder="e.g., The person smiles gently and turns their head slightly to the left"
            rows={3}
            disabled={isDisabled}
            className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
              validationError || isOverLimit
                ? 'border-red-300 focus:ring-red-500'
                : 'border-gray-300'
            } ${isDisabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          />
          <div className="flex justify-between mt-1">
            <span className={`text-xs ${validationError ? 'text-red-500' : 'text-gray-500'}`}>
              {validationError || 'Required: 1-500 characters'}
            </span>
            <span className={`text-xs ${isOverLimit ? 'text-red-500' : 'text-gray-400'}`}>
              {charCount}/{PROMPT_MAX_LENGTH}
            </span>
          </div>
        </div>

        {/* Resolution Dropdown */}
        <div>
          <label htmlFor="animation-resolution" className="block text-xs font-medium text-gray-700 mb-1">
            Video Resolution
          </label>
          <select
            id="animation-resolution"
            value={resolution}
            onChange={handleResolutionChange}
            disabled={isDisabled}
            className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDisabled ? 'bg-gray-100 cursor-not-allowed' : ''
            }`}
          >
            {RESOLUTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {RESOLUTION_OPTIONS.find((o) => o.value === resolution)?.description}
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isDisabled || !prompt.trim() || isOverLimit}
          className={`w-full py-2 px-4 text-sm font-medium rounded-md transition-colors flex items-center justify-center ${
            isDisabled || !prompt.trim() || isOverLimit
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
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
              Starting Animation...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Generate Animation
            </>
          )}
        </button>

        {/* Processing time note */}
        <p className="text-xs text-gray-500 text-center">
          Animation takes 2-5 minutes depending on resolution
        </p>
      </form>
    </div>
  );
};

export default AnimationControls;
