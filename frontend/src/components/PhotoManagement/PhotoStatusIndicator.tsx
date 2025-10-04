'use client';

import React from 'react';
import { PhotoStatusIndicatorProps } from '../../types/photo-management';

/**
 * PhotoStatusIndicator Component
 * 
 * Visual status indicators for different processing states.
 * Features:
 * - Animated overlays for different states (queued, processing, completed, failed)
 * - Progress indicators for active processing
 * - Retry functionality for failed jobs
 * - Tooltip information on hover
 */
export const PhotoStatusIndicator: React.FC<PhotoStatusIndicatorProps> = ({
  status,
  progress = 0,
  estimatedTime,
  onRetry
}) => {
  // Status configuration
  const statusConfig = {
    ready: {
      icon: '✓',
      color: 'text-green-500',
      bgColor: 'bg-green-100',
      animation: '',
      text: 'Ready to Process',
      showProgress: false
    },
    queued: {
      icon: '⏱️',
      color: 'text-blue-500',
      bgColor: 'bg-blue-100',
      animation: 'animate-pulse',
      text: 'In Queue',
      showProgress: false
    },
    processing: {
      icon: '⚙️',
      color: 'text-orange-500',
      bgColor: 'bg-orange-100',
      animation: 'animate-spin',
      text: 'Processing...',
      showProgress: true
    },
    completed: {
      icon: '✅',
      color: 'text-green-500',
      bgColor: 'bg-green-100',
      animation: 'animate-bounce',
      text: 'Completed',
      showProgress: false
    },
    failed: {
      icon: '❌',
      color: 'text-red-500',
      bgColor: 'bg-red-100',
      animation: 'animate-shake',
      text: 'Failed - Tap to Retry',
      showProgress: false
    }
  };

  const config = statusConfig[status] || statusConfig.ready;

  // Format estimated time
  const formatEstimatedTime = (seconds?: number) => {
    if (!seconds) return '';
    
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      return `${Math.round(seconds / 60)}m`;
    } else {
      return `${Math.round(seconds / 3600)}h`;
    }
  };

  return (
    <div className="absolute bottom-2 left-2 right-2">
      {/* Status Badge */}
      <div className={`
        flex items-center justify-center px-2 py-1 rounded-full text-xs font-medium
        ${config.bgColor} ${config.color} ${config.animation}
        backdrop-blur-sm bg-opacity-90
        transition-all duration-200
        hover:scale-105
      `}>
        {/* Status Icon */}
        <span className="mr-1 text-sm">
          {config.icon}
        </span>
        
        {/* Status Text */}
        <span className="truncate">
          {config.text}
        </span>
        
        {/* Estimated Time */}
        {estimatedTime && (
          <span className="ml-1 opacity-75">
            ({formatEstimatedTime(estimatedTime)})
          </span>
        )}
      </div>

      {/* Progress Bar */}
      {config.showProgress && progress > 0 && (
        <div className="mt-1 w-full bg-gray-200 rounded-full h-1">
          <div
            className="bg-orange-500 h-1 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}

      {/* Retry Button for Failed Status */}
      {status === 'failed' && onRetry && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRetry();
          }}
          className="mt-1 w-full bg-red-500 hover:bg-red-600 text-white text-xs py-1 px-2 rounded transition-colors duration-200"
        >
          Retry
        </button>
      )}
    </div>
  );
};

export default PhotoStatusIndicator;
