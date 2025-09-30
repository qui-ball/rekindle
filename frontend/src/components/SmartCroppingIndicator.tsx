// Smart cropping status indicator for cropping interface
'use client';

import React from 'react';
import { useAppInitialization } from '../hooks/useAppInitialization';

interface SmartCroppingIndicatorProps {
  show?: boolean;
  className?: string;
  hasSmartDetection?: boolean;
  confidence?: number;
}

export const SmartCroppingIndicator: React.FC<SmartCroppingIndicatorProps> = ({
  show = true,
  className = '',
  hasSmartDetection: propHasSmartDetection,
  confidence
}) => {
  const { status, progress, hasSmartDetection: hookHasSmartDetection } = useAppInitialization();
  
  // Use prop value if provided, otherwise fall back to hook value
  const hasSmartDetection = propHasSmartDetection !== undefined ? propHasSmartDetection : hookHasSmartDetection;

  if (!show) return null;

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      {status === 'loading' && (
        <div className="flex items-center gap-2 text-blue-600">
          <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading smart detection... {Math.round(progress)}%</span>
        </div>
      )}
      
      {status === 'ready' && hasSmartDetection && (
        <div className="flex items-center gap-2 text-green-600">
          <div className="w-3 h-3 bg-green-600 rounded-full"></div>
          <span>
            Smart detection ready
            {confidence !== undefined && (
              <span className="ml-2 text-xs opacity-75">
                ({Math.round(confidence * 100)}% confidence)
              </span>
            )}
          </span>
        </div>
      )}
      
      {status === 'fallback' && (
        <div className="flex items-center gap-2 text-yellow-600">
          <div className="w-3 h-3 bg-yellow-600 rounded-full"></div>
          <span>Basic cropping mode</span>
        </div>
      )}
    </div>
  );
};