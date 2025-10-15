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

  // Initialize smart detection in background
  useAppInitialization();

  // Don't show loading screen during SSR or before mount
  if (!mounted) {
    return <>{children}</>;
  }

  // Always render children - let OpenCV.js load in background
  return <>{children}</>;
};