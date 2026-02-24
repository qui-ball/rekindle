'use client';

import React from 'react';
import { 
  ProcessingParameterDrawerProps, 
  RestoreParameters, 
  AnimateParameters
} from '../../types/photo-management';
import { Body } from '@/components/ui';

/**
 * ProcessingParameterDrawer Component
 * 
 * Collapsible parameter drawer that appears below each processing option when checked.
 * Features:
 * - Smooth slide-down/slide-up animations
 * - Push content down behavior when drawer opens
 * - Common parameters section (always visible when open)
 * - Advanced options toggle for additional parameters
 * - Real-time parameter updates
 */
export const ProcessingParameterDrawer: React.FC<ProcessingParameterDrawerProps> = ({
  processingType,
  isOpen,
  parameters,
  onParametersChange,
  advancedOptionsOpen,
  onToggleAdvancedOptions
}) => {
  
  // Type guards to narrow parameter types
  const isRestoreParameters = (params: typeof parameters): params is RestoreParameters => {
    return processingType === 'restore';
  };

  const isAnimateParameters = (params: typeof parameters): params is AnimateParameters => {
    return processingType === 'animate';
  };

  // Handle parameter changes
  const handleRestoreParameterChange = (field: keyof RestoreParameters, value: boolean | number | string) => {
    if (isRestoreParameters(parameters)) {
      onParametersChange({
        ...parameters,
        [field]: value
      } as RestoreParameters);
    }
  };

  const handleAnimateParameterChange = (field: keyof AnimateParameters, value: number | string) => {
    if (isAnimateParameters(parameters)) {
      onParametersChange({
        ...parameters,
        [field]: value
      } as AnimateParameters);
    }
  };

  // Render restore parameters
  const renderRestoreParameters = () => {
    if (!isRestoreParameters(parameters)) return null;

    return (
      <>
        {/* Common Parameters */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-cozy-textSecondary uppercase tracking-wide">Common Parameters</p>
          
          {/* Colourize Checkbox */}
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={parameters.colourize}
              onChange={(e) => handleRestoreParameterChange('colourize', e.target.checked)}
              className="w-4 h-4 text-cozy-accent border-cozy-borderCard rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-cozy-accent"
            />
            <div>
              <span className="text-sm font-medium text-cozy-heading">Colourize</span>
              <Body className="text-xs text-cozy-textSecondary">Add realistic colors during restoration (+2 credits)</Body>
            </div>
          </label>
        </div>

        {/* Advanced Options */}
        <div className="mt-4 border-t border-cozy-borderCard pt-4">
          <button
            onClick={onToggleAdvancedOptions}
            className="flex items-center justify-between w-full text-sm font-medium text-cozy-text hover:text-cozy-heading transition-colors"
          >
            <span>Advanced Options</span>
            <svg 
              className={`w-4 h-4 transition-transform duration-200 ${advancedOptionsOpen ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Advanced Options Content */}
          <div 
            className={`overflow-hidden transition-all duration-250 ease-in-out ${
              advancedOptionsOpen ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="space-y-4">
              {/* Denoise Level Slider */}
              <div>
                <label className="block text-sm font-medium text-cozy-heading mb-2">
                  Denoise Level: {(parameters.denoiseLevel || 0.7).toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="0.9"
                  step="0.01"
                  value={parameters.denoiseLevel || 0.7}
                  onChange={(e) => handleRestoreParameterChange('denoiseLevel', parseFloat(e.target.value))}
                  className="w-full h-2 bg-cozy-borderCard rounded-cozy-lg appearance-none cursor-pointer accent-cozy-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-cozy-accent focus-visible:ring-offset-2 focus-visible:ring-offset-cozy-surface"
                />
                <div className="flex justify-between text-xs text-cozy-textSecondary mt-1">
                  <span>0.5 (Less)</span>
                  <span>0.9 (More)</span>
                </div>
                <Body className="text-xs text-cozy-textSecondary mt-1">
                  Higher values reduce noise but may soften details
                </Body>
              </div>

              {/* User Prompt Text Input */}
              <div>
                <label className="block text-sm font-medium text-cozy-heading mb-2">
                  User Prompt (Optional)
                </label>
                <textarea
                  value={parameters.userPrompt || ''}
                  onChange={(e) => handleRestoreParameterChange('userPrompt', e.target.value)}
                  placeholder="e.g., Focus on face details, preserve background texture..."
                  rows={3}
                  className="w-full px-3 py-2 border border-cozy-borderCard rounded-cozy-lg text-sm text-cozy-text focus:outline-none focus-visible:ring-2 focus-visible:ring-cozy-accent focus-visible:border-transparent resize-none"
                />
                <Body className="text-xs text-cozy-textSecondary mt-1">
                  Provide specific instructions for the restoration process
                </Body>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  // Render animate parameters
  const renderAnimateParameters = () => {
    if (!isAnimateParameters(parameters)) return null;

    return (
      <>
        {/* Common Parameters */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-cozy-textSecondary uppercase tracking-wide">Common Parameters</p>
          
          {/* Video Duration Slider */}
          <div>
            <label className="block text-sm font-medium text-cozy-heading mb-2">
              Video Duration: {parameters.videoDuration} seconds
            </label>
            <input
              type="range"
              min="5"
              max="30"
              value={parameters.videoDuration}
              onChange={(e) => handleAnimateParameterChange('videoDuration', parseInt(e.target.value))}
              className="w-full h-2 bg-cozy-borderCard rounded-cozy-lg appearance-none cursor-pointer accent-cozy-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-cozy-accent focus-visible:ring-offset-2 focus-visible:ring-offset-cozy-surface"
            />
            <div className="flex justify-between text-xs text-cozy-textSecondary mt-1">
              <span>5s</span>
              <span>15s</span>
              <span>30s</span>
            </div>
            <Body className="text-xs text-cozy-textSecondary mt-1">
              Longer videos cost more to process (10-50 credits)
            </Body>
          </div>
        </div>

        {/* Advanced Options */}
        <div className="mt-4 border-t border-cozy-borderCard pt-4">
          <button
            onClick={onToggleAdvancedOptions}
            className="flex items-center justify-between w-full text-sm font-medium text-cozy-text hover:text-cozy-heading transition-colors"
          >
            <span>Advanced Options</span>
            <svg 
              className={`w-4 h-4 transition-transform duration-200 ${advancedOptionsOpen ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Advanced Options Content */}
          <div 
            className={`overflow-hidden transition-all duration-250 ease-in-out ${
              advancedOptionsOpen ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="space-y-4">
              {/* User Prompt Text Input */}
              <div>
                <label className="block text-sm font-medium text-cozy-heading mb-2">
                  User Prompt (Optional)
                </label>
                <textarea
                  value={parameters.userPrompt || ''}
                  onChange={(e) => handleAnimateParameterChange('userPrompt', e.target.value)}
                  placeholder="e.g., Make eyes blink and subtle smile..."
                  rows={3}
                  className="w-full px-3 py-2 border border-cozy-borderCard rounded-cozy-lg text-sm text-cozy-text focus:outline-none focus-visible:ring-2 focus-visible:ring-cozy-accent focus-visible:border-transparent resize-none"
                />
                <Body className="text-xs text-cozy-textSecondary mt-1">
                  Describe the animation effects you want
                </Body>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  // Render bring together parameters (placeholder for future)
  const renderBringTogetherParameters = () => {
    return (
      <Body className="text-sm text-cozy-textSecondary italic">
        Parameters for Bring Together will be available soon.
      </Body>
    );
  };

  // Render appropriate parameters based on processing type
  const renderParameters = () => {
    switch (processingType) {
      case 'restore':
        return renderRestoreParameters();
      case 'animate':
        return renderAnimateParameters();
      case 'bringTogether':
        return renderBringTogetherParameters();
      default:
        return null;
    }
  };

  return (
    <div 
      className={`overflow-hidden transition-all duration-300 ease-in-out ${
        isOpen ? 'max-h-[600px] opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'
      }`}
    >
      <div className="ml-8 p-4 bg-cozy-mount rounded-cozy-lg border border-cozy-borderCard">
        {renderParameters()}
      </div>
    </div>
  );
};

export default ProcessingParameterDrawer;

