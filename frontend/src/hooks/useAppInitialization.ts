// React hook for app initialization with OpenCV.js preloading
import { useState, useEffect } from 'react';
import { appInitialization, AppInitializationState } from '../services/appInitialization';

export const useAppInitialization = () => {
  const [state, setState] = useState<AppInitializationState>({
    status: 'loading',
    progress: 0,
    message: 'Initializing app...'
  });

  useEffect(() => {
    // Only initialize in browser environment
    if (typeof window === 'undefined') {
      return;
    }

    // Check if already initialized
    if (appInitialization.isReady()) {
      setState({
        status: appInitialization.getStatus(),
        progress: 100,
        message: appInitialization.hasSmartDetection() 
          ? 'Smart photo detection ready!' 
          : 'App ready with basic cropping'
      });
      return;
    }

    // Start initialization with error handling
    const initializeApp = async () => {
      try {
        await appInitialization.initialize(setState);
      } catch (error) {
        console.error('App initialization failed:', error);
        setState({
          status: 'fallback',
          progress: 100,
          message: 'App ready with basic features',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };

    initializeApp();
  }, []);

  return {
    ...state,
    isReady: true, // App is always ready - OpenCV.js loads in background
    hasSmartDetection: appInitialization.hasSmartDetection(),
    reinitialize: () => {
      setState({
        status: 'loading',
        progress: 0,
        message: 'Reinitializing app...'
      });
      appInitialization.initialize(setState);
    }
  };
};