// React hook for JScanify integration
import { useState, useEffect, useCallback } from 'react';
import { jscanifyService, DetectionResult } from '../services/jscanifyService';
import { useOpenCVLoader } from '../services/opencvLoader';

export interface JScanifyState {
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
}

export const useJScanify = () => {
  const [state, setState] = useState<JScanifyState>({
    isInitialized: false,
    isInitializing: false,
    error: null
  });

  const { status: opencvStatus, isReady: isOpenCVReady } = useOpenCVLoader();

  // Initialize JScanify when OpenCV is ready
  useEffect(() => {
    const isOpenCVReadyValue = isOpenCVReady();
    
    if (isOpenCVReadyValue && !jscanifyService.isInitialized() && !state.isInitializing) {
      setState(prev => ({ ...prev, isInitializing: true, error: null }));
      
      jscanifyService.initialize()
        .then((success) => {
          setState({
            isInitialized: success,
            isInitializing: false,
            error: success ? null : 'Failed to initialize JScanify'
          });
        })
        .catch((error) => {
          setState({
            isInitialized: false,
            isInitializing: false,
            error: error.message || 'JScanify initialization error'
          });
        });
    }
  }, [isOpenCVReady, state.isInitializing]);

  // Detect photo boundaries
  const detectBoundaries = useCallback(async (
    imageData: string,
    imageWidth: number,
    imageHeight: number
  ): Promise<DetectionResult> => {
    if (!state.isInitialized) {
      console.warn('JScanify not initialized, using fallback detection');
      return {
        detected: false,
        cropArea: {
          x: Math.round(imageWidth * 0.1),
          y: Math.round(imageHeight * 0.1),
          width: Math.round(imageWidth * 0.8),
          height: Math.round(imageHeight * 0.8)
        },
        confidence: 0.5
      };
    }

    return jscanifyService.detectPhotoBoundaries(imageData, imageWidth, imageHeight);
  }, [state.isInitialized]);

  return {
    // State
    isInitialized: state.isInitialized,
    isInitializing: state.isInitializing || opencvStatus === 'loading',
    error: state.error || (opencvStatus === 'error' ? 'OpenCV loading failed' : null),
    
    // OpenCV status
    opencvStatus,
    
    // Methods
    detectBoundaries,
    
    // Utility
    isReady: state.isInitialized && isOpenCVReady()
  };
};