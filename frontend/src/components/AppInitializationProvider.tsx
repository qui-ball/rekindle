// App initialization provider with loading screen
'use client';

import React from 'react';
import { useAppInitialization } from '../hooks/useAppInitialization';

interface AppInitializationProviderProps {
  children: React.ReactNode;
}

export const AppInitializationProvider: React.FC<AppInitializationProviderProps> = ({
  children
}) => {
  const [mounted, setMounted] = React.useState(false);
  
  // Ensure we're mounted before initializing to avoid SSR issues
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const {
    status,
    hasSmartDetection
  } = useAppInitialization();

  // Don't show loading screen during SSR or before mount
  if (!mounted) {
    return <>{children}</>;
  }

  // Always render children - let OpenCV.js load in background
  return (
    <>
      {children}
      {/* Small non-intrusive indicator showing smart detection status */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded z-50">
          {status === 'loading' && (
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              Loading Smart Detection...
            </span>
          )}
          {status === 'ready' && hasSmartDetection && '🎯 Smart Detection Ready'}
          {status === 'fallback' && '📋 Basic Mode'}
        </div>
      )}
    </>
  );
};