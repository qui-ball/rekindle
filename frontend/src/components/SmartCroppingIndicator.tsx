// Smart cropping status indicator for cropping interface
'use client';

import React from 'react';
import { useAppInitialization } from '../hooks/useAppInitialization';

interface SmartCroppingIndicatorProps {
  show?: boolean;
  className?: string;
}

export const SmartCroppingIndicator: React.FC<SmartCroppingIndicatorProps> = ({
  show = true,
  className = ''
}) => {
  const { status, progress, hasSmartDetection } = useAppInitialization();

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
          <span>Smart detection ready</span>
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