'use client';

import React from 'react';
import { 
  ProcessingParameterDrawerProps, 
  RestoreParameters, 
  AnimateParameters, 
  BringTogetherParameters 
} from '../../types/photo-management';

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
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Common Parameters</p>
          
          {/* Colourize Checkbox */}
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={parameters.colourize}
              onChange={(e) => handleRestoreParameterChange('colourize', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">Colourize</span>
              <p className="text-xs text-gray-500">Add realistic colors during restoration (+2 credits)</p>
            </div>
          </label>
        </div>

        {/* Advanced Options */}
        <div className="mt-4 border-t border-gray-200 pt-4">
          <button
            onClick={onToggleAdvancedOptions}
            className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Denoise Level: {(parameters.denoiseLevel || 0.7).toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="0.9"
                  step="0.01"
                  value={parameters.denoiseLevel || 0.7}
                  onChange={(e) => handleRestoreParameterChange('denoiseLevel', parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0.5 (Less)</span>
                  <span>0.9 (More)</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Higher values reduce noise but may soften details
                </p>
              </div>

              {/* User Prompt Text Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User Prompt (Optional)
                </label>
                <textarea
                  value={parameters.userPrompt || ''}
                  onChange={(e) => handleRestoreParameterChange('userPrompt', e.target.value)}
                  placeholder="e.g., Focus on face details, preserve background texture..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Provide specific instructions for the restoration process
                </p>
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
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Common Parameters</p>
          
          {/* Video Duration Slider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Video Duration: {parameters.videoDuration} seconds
            </label>
            <input
              type="range"
              min="5"
              max="30"
              value={parameters.videoDuration}
              onChange={(e) => handleAnimateParameterChange('videoDuration', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>5s</span>
              <span>15s</span>
              <span>30s</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Longer videos cost more to process (10-50 credits)
            </p>
          </div>
        </div>

        {/* Advanced Options */}
        <div className="mt-4 border-t border-gray-200 pt-4">
          <button
            onClick={onToggleAdvancedOptions}
            className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User Prompt (Optional)
                </label>
                <textarea
                  value={parameters.userPrompt || ''}
                  onChange={(e) => handleAnimateParameterChange('userPrompt', e.target.value)}
                  placeholder="e.g., Make eyes blink and subtle smile..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Describe the animation effects you want
                </p>
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
      <div className="text-sm text-gray-500 italic">
        Parameters for Bring Together will be available soon.
      </div>
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
      <div className="ml-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
        {renderParameters()}
      </div>
    </div>
  );
};

export default ProcessingParameterDrawer;

