/**
 * CameraCapture Component
 * 
 * Provides mobile camera interface with guided capture experience for physical photos.
 * Uses react-camera-pro for PWA camera integration with back camera as default.
 * 
 * Features:
 * - Back camera default for physical photo capture
 * - Camera permission handling and error states
 * - Advanced visual guides overlay for optimal positioning
 * - Lighting quality detection and user guidance
 * - Enhanced capture button with visual feedback
 * - Real-time positioning guidance for physical photos
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Camera } from 'react-camera-pro';
import { CameraCaptureProps, CameraError } from './types';

// Lighting quality thresholds - more lenient for better user experience
const LIGHTING_THRESHOLDS = {
  TOO_DARK: 20,
  GOOD_MIN: 30,
  GOOD_MAX: 240,
  TOO_BRIGHT: 250
};

type LightingQuality = 'too-dark' | 'good' | 'too-bright' | 'unknown';
type BlurQuality = 'sharp' | 'blurry' | 'unknown';

interface LightingAnalysis {
  quality: LightingQuality;
  brightness: number;
  message: string;
}

interface BlurAnalysis {
  quality: BlurQuality;
  sharpness: number;
  message: string;
}

// Blur detection thresholds
const BLUR_THRESHOLDS = {
  SHARP_MIN: 15, // Minimum variance for sharp images
  BLURRY_MAX: 8  // Maximum variance for blurry images
};

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCapture,
  onError,
  facingMode = 'environment', // Back camera default
  aspectRatio = 4/3
}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [lightingAnalysis, setLightingAnalysis] = useState<LightingAnalysis>({
    quality: 'unknown',
    brightness: 0,
    message: 'Analyzing lighting...'
  });
  const [blurAnalysis, setBlurAnalysis] = useState<BlurAnalysis>({
    quality: 'unknown',
    sharpness: 0,
    message: 'Analyzing sharpness...'
  });

  const cameraRef = useRef<{ takePhoto: () => string | null } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lightingCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Handle orientation changes - mobile landscape only
  const handleOrientationChange = useCallback(() => {
    // Detect mobile devices more reliably - check the smaller dimension
    // Mobile devices have a smaller dimension (portrait width or landscape height) <= 768px
    const smallerDimension = Math.min(window.innerWidth, window.innerHeight);
    const isMobile = smallerDimension <= 768;
    const isCurrentlyLandscape = window.innerWidth > window.innerHeight;
    setIsLandscape(isMobile && isCurrentlyLandscape);
  }, []);

  // Analyze blur/sharpness quality from camera feed
  const analyzeBlur = useCallback(() => {
    if (!cameraRef.current || !canvasRef.current) return;

    try {
      // Get current frame from camera
      const video = document.querySelector('video');
      if (!video || video.readyState !== 4) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size to match video
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      // Draw current frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get image data for analysis
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Calculate Laplacian variance for blur detection
      const width = canvas.width;
      const height = canvas.height;
      let variance = 0;
      let count = 0;

      // Sample center region for performance (avoid edges)
      const startX = Math.floor(width * 0.25);
      const endX = Math.floor(width * 0.75);
      const startY = Math.floor(height * 0.25);
      const endY = Math.floor(height * 0.75);

      for (let y = startY + 1; y < endY - 1; y++) {
        for (let x = startX + 1; x < endX - 1; x += 4) { // Sample every 4th pixel for performance
          const idx = (y * width + x) * 4;
          
          // Convert to grayscale
          const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          
          // Calculate Laplacian (edge detection)
          const topIdx = ((y - 1) * width + x) * 4;
          const bottomIdx = ((y + 1) * width + x) * 4;
          const leftIdx = (y * width + (x - 1)) * 4;
          const rightIdx = (y * width + (x + 1)) * 4;
          
          const topGray = 0.299 * data[topIdx] + 0.587 * data[topIdx + 1] + 0.114 * data[topIdx + 2];
          const bottomGray = 0.299 * data[bottomIdx] + 0.587 * data[bottomIdx + 1] + 0.114 * data[bottomIdx + 2];
          const leftGray = 0.299 * data[leftIdx] + 0.587 * data[leftIdx + 1] + 0.114 * data[leftIdx + 2];
          const rightGray = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];
          
          const laplacian = Math.abs(-4 * gray + topGray + bottomGray + leftGray + rightGray);
          variance += laplacian * laplacian;
          count++;
        }
      }

      const avgVariance = count > 0 ? variance / count : 0;

      // Determine blur quality
      let quality: BlurQuality;
      let message: string;

      if (avgVariance >= BLUR_THRESHOLDS.SHARP_MIN) {
        quality = 'sharp';
        message = 'Sharp focus';
      } else if (avgVariance <= BLUR_THRESHOLDS.BLURRY_MAX) {
        quality = 'blurry';
        message = 'Too blurry - hold steady';
      } else {
        quality = 'sharp'; // Acceptable sharpness
        message = 'Focus acceptable';
      }

      setBlurAnalysis({
        quality,
        sharpness: Math.round(avgVariance),
        message
      });
    } catch (error) {
      console.warn('Blur analysis failed:', error);
      setBlurAnalysis({
        quality: 'unknown',
        sharpness: 0,
        message: 'Unable to analyze focus'
      });
    }
  }, []);

  // Analyze lighting quality from camera feed
  const analyzeLighting = useCallback(() => {
    if (!cameraRef.current || !canvasRef.current) return;

    try {
      // Get current frame from camera
      const video = document.querySelector('video');
      if (!video || video.readyState !== 4) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size to match video
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      // Draw current frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get image data for analysis
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Calculate average brightness
      let totalBrightness = 0;
      const sampleSize = Math.min(data.length / 4, 10000); // Sample for performance

      for (let i = 0; i < sampleSize * 4; i += 16) { // Sample every 4th pixel
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Calculate perceived brightness using luminance formula
        const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
        totalBrightness += brightness;
      }

      const avgBrightness = totalBrightness / sampleSize;

      // Determine lighting quality - more lenient thresholds
      let quality: LightingQuality;
      let message: string;

      if (avgBrightness < LIGHTING_THRESHOLDS.TOO_DARK) {
        quality = 'too-dark';
        message = 'Very dark - try more light';
      } else if (avgBrightness > LIGHTING_THRESHOLDS.TOO_BRIGHT) {
        quality = 'too-bright';
        message = 'Very bright - try less light';
      } else {
        quality = 'good'; // Much more lenient - most conditions are acceptable
        message = 'Ready to capture';
      }

      setLightingAnalysis({
        quality,
        brightness: Math.round(avgBrightness),
        message
      });
    } catch (error) {
      console.warn('Lighting analysis failed:', error);
      setLightingAnalysis({
        quality: 'unknown',
        brightness: 0,
        message: 'Unable to analyze lighting'
      });
    }
  }, []);

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

  // Handle orientation changes
  useEffect(() => {
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Initial orientation check
    handleOrientationChange();
    
    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [handleOrientationChange]);

  // Start quality analysis when camera is initialized
  useEffect(() => {
    if (isInitialized && permissionStatus === 'granted') {
      // Start periodic quality analysis
      lightingCheckInterval.current = setInterval(() => {
        analyzeLighting();
        analyzeBlur();
      }, 1000); // Check every second

      return () => {
        if (lightingCheckInterval.current) {
          clearInterval(lightingCheckInterval.current);
        }
      };
    }
  }, [isInitialized, permissionStatus, analyzeLighting, analyzeBlur]);



  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (lightingCheckInterval.current) {
        clearInterval(lightingCheckInterval.current);
      }
    };
  }, []);

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
    <div className="h-full w-full relative bg-black camera-fullscreen">
      {/* Hidden canvas for quality analysis */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Camera Container - Fill parent with forced full screen */}
      <div className="absolute inset-0 bg-black">
        <div className="w-full h-full overflow-hidden">
          <Camera
            ref={cameraRef}
            facingMode={facingMode}
            errorMessages={{
              noCameraAccessible: 'No camera device accessible. Please connect your camera or try a different browser.',
              permissionDenied: 'Permission denied. Please refresh and give camera permission.',
              switchCamera: 'It is not possible to switch camera to different one because there is only one video device accessible.',
              canvas: 'Canvas is not supported.'
            }}
          />
        </div>
      </div>
      
      {/* Global CSS to force video to fill screen */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .camera-fullscreen video {
            width: 100vw !important;
            height: 100vh !important;
            object-fit: cover !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            z-index: 1 !important;
          }
          
          /* Additional mobile landscape fixes */
          @media screen and (orientation: landscape) and (max-height: 768px) {
            .camera-fullscreen video {
              width: 100vw !important;
              height: 100vh !important;
              min-width: 100vw !important;
              min-height: 100vh !important;
              transform: translateX(0) translateY(0) !important;
            }
          }
        `
      }} />

      {/* Quality Indicators - Responsive positioning */}
      <div className={`absolute z-10 flex space-x-3 ${
        isLandscape 
          ? 'bottom-6 right-20 flex-row' // Landscape mobile: right side but inset from edge
          : 'bottom-12 left-4 flex-row'  // Desktop & portrait mobile: lowered from bottom-16 to bottom-12
      }`}>
        {/* Lighting status indicator */}
        <div className="flex flex-col items-center bg-black bg-opacity-50 rounded-lg p-2">
          <div className={`w-4 h-4 rounded-full mb-1 ${
            lightingAnalysis.quality === 'good' 
              ? 'bg-green-500' 
              : lightingAnalysis.quality === 'too-dark'
              ? 'bg-red-500'
              : lightingAnalysis.quality === 'too-bright'
              ? 'bg-orange-500'
              : 'bg-gray-400'
          }`}></div>
          <span className="text-xs text-white font-medium">Light</span>
        </div>

        {/* Blur status indicator */}
        <div className="flex flex-col items-center bg-black bg-opacity-50 rounded-lg p-2">
          <div className={`w-4 h-4 rounded-full mb-1 ${
            blurAnalysis.quality === 'sharp' 
              ? 'bg-green-500' 
              : blurAnalysis.quality === 'blurry'
              ? 'bg-red-500'
              : 'bg-gray-400'
          }`}></div>
          <span className="text-xs text-white font-medium">Focus</span>
        </div>
      </div>

      {/* Main capture button - Responsive positioning */}
      <div className={`absolute z-10 ${
        isLandscape 
          ? 'right-20 top-1/2 transform -translate-y-1/2' // Landscape mobile: right side but further inset from edge
          : 'bottom-12 left-1/2 transform -translate-x-1/2' // Desktop & portrait mobile: lowered to align with quality indicators
      }`}>
        <button
          onClick={handleCapture}
          disabled={!isInitialized || isCapturing}
          className={`
            w-20 h-20 rounded-full border-4 transition-all duration-200 shadow-2xl
            flex items-center justify-center text-3xl relative
            ${!isInitialized || isCapturing 
              ? 'border-gray-400 bg-gray-300 opacity-50 cursor-not-allowed' 
              : (lightingAnalysis.quality === 'good' && blurAnalysis.quality === 'sharp')
              ? 'border-green-400 bg-green-500 hover:bg-green-600 active:scale-95 text-white'
              : 'border-red-400 bg-red-500 hover:bg-red-600 active:scale-95 text-white'
            }
          `}
          aria-label="Capture photo"
        >
          {isCapturing ? (
            <div className="animate-spin w-8 h-8 border-3 border-white border-t-transparent rounded-full"></div>
          ) : (
            <>
              <span>📷</span>
              {(lightingAnalysis.quality === 'good' && blurAnalysis.quality === 'sharp') && (
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-400 rounded-full flex items-center justify-center text-white text-sm">
                  ✓
                </div>
              )}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CameraCapture;