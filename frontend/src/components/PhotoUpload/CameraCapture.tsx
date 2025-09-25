/**
 * CameraCapture Component
 * 
 * Provides mobile camera interface with guided capture experience for physical photos.
 * Uses react-camera-pro for PWA camera integration with back camera as default.
 * 
 * Features:
 * - Back camera default for physical photo capture
 * - Camera permission handling and error states
 * - Visual guides overlay for optimal positioning
 * - Capture functionality with base64 output
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Camera } from 'react-camera-pro';
import { CameraCaptureProps, CameraError } from './types';

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCapture,
  onError,
  facingMode = 'environment', // Back camera default
  aspectRatio = 4/3
}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<any>(null);

  // Handle camera errors
  const handleCameraError = useCallback((error: Error & { name?: string }) => {
    console.error('Camera error:', error);
    
    let cameraError: CameraError;
    
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      setPermissionStatus('denied');
      cameraError = {
        code: 'CAMERA_PERMISSION_DENIED',
        message: 'Camera access was denied. Please allow camera permission and try again.',
        name: error.name
      };
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      cameraError = {
        code: 'CAMERA_NOT_FOUND',
        message: 'No camera found on this device.',
        name: error.name
      };
    } else if (error.name === 'NotSupportedError') {
      cameraError = {
        code: 'CAMERA_NOT_SUPPORTED',
        message: 'Camera is not supported in this browser.',
        name: error.name
      };
    } else {
      cameraError = {
        code: 'CAMERA_UNKNOWN_ERROR',
        message: 'An unknown camera error occurred. Please try again.',
        name: error.name || 'UnknownError'
      };
    }
    
    onError(cameraError);
  }, [onError]);

  // Handle photo capture
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;
    
    try {
      setIsCapturing(true);
      const imageData = await cameraRef.current.takePhoto();
      
      if (imageData) {
        onCapture(imageData);
      } else {
        throw new Error('Failed to capture image');
      }
    } catch (error) {
      console.error('Capture error:', error);
      const cameraError: CameraError = {
        code: 'CAPTURE_FAILED',
        message: 'Failed to capture photo. Please try again.',
        name: 'CaptureError'
      };
      onError(cameraError);
    } finally {
      setIsCapturing(false);
    }
  }, [onCapture, onError, isCapturing]);

  // Request camera permission on mount
  useEffect(() => {
    const requestPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode }
        });
        // Close the stream immediately as react-camera-pro will handle it
        stream.getTracks().forEach(track => track.stop());
        setPermissionStatus('granted');
        setIsInitialized(true);
      } catch (error) {
        handleCameraError(error as Error);
      }
    };

    if (navigator.mediaDevices) {
      requestPermission();
    } else {
      const cameraError: CameraError = {
        code: 'CAMERA_NOT_SUPPORTED',
        message: 'Camera is not supported in this browser.',
        name: 'NotSupportedError'
      };
      onError(cameraError);
    }
  }, [facingMode, handleCameraError, onError]);

  // Render permission denied state
  if (permissionStatus === 'denied') {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-gray-100 rounded-lg p-6">
        <div className="text-6xl mb-4">📷</div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Camera Access Needed</h3>
        <p className="text-gray-600 text-center mb-4">
          We need camera access to take photos. Please allow camera permission and refresh the page.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh Page
        </button>
      </div>
    );
  }

  // Render loading state
  if (permissionStatus === 'pending') {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-gray-100 rounded-lg p-6">
        <div className="animate-spin text-4xl mb-4">📷</div>
        <p className="text-gray-600">Requesting camera access...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Camera Container */}
      <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio }}>
        <Camera
          ref={cameraRef}
          aspectRatio={aspectRatio}
          facingMode={facingMode}
          errorMessages={{
            noCameraAccessible: 'No camera device accessible. Please connect your camera or try a different browser.',
            permissionDenied: 'Permission denied. Please refresh and give camera permission.',
            switchCamera: 'It is not possible to switch camera to different one because there is only one video device accessible.',
            canvas: 'Canvas is not supported.'
          }}
        />
        
        {/* Visual Guide Overlay */}
        {isInitialized && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Corner guides for photo positioning */}
            <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-white opacity-70"></div>
            <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-white opacity-70"></div>
            <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-white opacity-70"></div>
            <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-white opacity-70"></div>
            
            {/* Center guide text */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded text-sm">
              Position photo within guides
            </div>
          </div>
        )}
      </div>

      {/* Capture Controls */}
      <div className="flex justify-center mt-4">
        <button
          onClick={handleCapture}
          disabled={!isInitialized || isCapturing}
          className={`
            w-16 h-16 rounded-full border-4 border-white bg-red-500 
            flex items-center justify-center text-white text-2xl
            transition-all duration-200 shadow-lg
            ${!isInitialized || isCapturing 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:bg-red-600 active:scale-95'
            }
          `}
          aria-label="Capture photo"
        >
          {isCapturing ? (
            <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full"></div>
          ) : (
            '📷'
          )}
        </button>
      </div>

      {/* Instructions */}
      <div className="mt-4 text-center text-sm text-gray-600">
        <p>Position your photo within the corner guides and tap the capture button</p>
      </div>
    </div>
  );
};

export default CameraCapture;