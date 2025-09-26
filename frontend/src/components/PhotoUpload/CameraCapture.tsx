/**
 * CameraCapture Component
 * 
 * Native PWA-optimized camera interface with maximum device resolution and native app behavior.
 * Integrated from PWACameraModal with enhanced orientation control and PWA detection.
 * 
 * Features:
 * - Native camera quality with maximum device resolution
 * - True full-screen behavior like native camera apps
 * - PWA compatible with iOS and Android optimization
 * - Native camera layout (portrait: controls at bottom, landscape: controls on right)
 * - Back camera default for physical photo capture
 * - PWA mode detection and optimization
 * - High-quality JPEG capture (0.95 quality) with no compression
 * - Enhanced orientation handling for PWA
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { CameraCaptureProps, CameraError } from './types';

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCapture,
  onError,
  facingMode = 'environment' // Back camera default
}) => {
  const [status, setStatus] = useState<string>('Starting camera...');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLandscape, setIsLandscape] = useState<boolean>(false);
  const [isPWA, setIsPWA] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isStartingRef = useRef<boolean>(false);

  // Detect PWA mode
  useEffect(() => {
    const checkPWA = () => {
      const isPWAMode = window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as any).standalone ||
                       document.referrer.includes('android-app://');
      setIsPWA(isPWAMode);
      console.log('PWA mode detected:', isPWAMode);
    };
    
    checkPWA();
  }, []);

  // Handle camera errors
  const handleCameraError = useCallback((error: Error & { name?: string }) => {
    console.error('Camera error:', error);
    
    let cameraError: CameraError;
    
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
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
    } else if (error.name === 'OverconstrainedError') {
      cameraError = {
        code: 'CAMERA_CONSTRAINT_ERROR',
        message: 'Camera constraints not supported. The app will try lower quality settings.',
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

  // Start camera with PWA optimizations and progressive fallback
  const startCamera = async () => {
    // Prevent multiple simultaneous starts
    if (isStartingRef.current || streamRef.current) {
      console.log('Camera already starting or started, skipping...');
      return;
    }
    
    try {
      isStartingRef.current = true;
      setStatus('Requesting camera access...');
      
      console.log('Starting PWA-optimized camera...');
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported');
      }
      
      // Progressive fallback constraints - try highest quality first
      const constraintOptions = [
        // Try maximum quality first
        {
          video: {
            facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: false
        },
        // Fallback to lower resolution
        {
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          },
          audio: false
        },
        // Basic fallback
        {
          video: {
            facingMode,
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        },
        // Minimal constraints as last resort
        {
          video: { facingMode },
          audio: false
        }
      ];
      
      let mediaStream: MediaStream | null = null;
      let lastError: Error | null = null;
      
      // Try each constraint set until one works
      for (let i = 0; i < constraintOptions.length; i++) {
        const constraints = constraintOptions[i];
        try {
          console.log(`Trying camera constraints (attempt ${i + 1}):`, constraints);
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log(`Camera constraints successful on attempt ${i + 1}`);
          break;
        } catch (error) {
          console.warn(`Camera constraints failed on attempt ${i + 1}:`, error);
          lastError = error as Error;
          
          // If this is an OverconstrainedError, try the next fallback
          if (error instanceof Error && error.name === 'OverconstrainedError') {
            continue;
          }
          
          // For other errors (permission, etc.), don't try fallbacks
          throw error;
        }
      }
      
      // If all attempts failed, throw the last error
      if (!mediaStream) {
        throw lastError || new Error('All camera constraint attempts failed');
      }
      
      console.log('PWA camera stream obtained with progressive fallback');
      
      setStream(mediaStream);
      streamRef.current = mediaStream;
      setStatus('Camera ready');
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        videoRef.current.onloadedmetadata = () => {
          console.log('PWA video metadata loaded');
          setStatus('Ready to capture');
          
          // Log actual resolution achieved
          if (videoRef.current) {
            console.log('Camera initialized with resolution:', 
              videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
          }
          
          // PWA-specific orientation lock
          if (isPWA && screen.orientation && 'lock' in screen.orientation) {
            (screen.orientation as any).lock('any').catch((error: any) => {
              console.log('PWA orientation lock failed:', error);
            });
          }
        };
        
        videoRef.current.onerror = (e) => {
          console.error('PWA video error:', e);
          handleCameraError(new Error('Video playback failed'));
        };
        
        try {
          await videoRef.current.play();
          console.log('PWA video playing');
        } catch (playError) {
          console.warn('PWA autoplay failed:', playError);
          setStatus('Ready to capture (tap to play)');
        }
      }
      
    } catch (err) {
      console.error('PWA camera error:', err);
      const error = err as Error;
      handleCameraError(error);
    } finally {
      isStartingRef.current = false;
    }
  };

  // Capture photo with PWA optimizations
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Canvas context not available');
      }

      // Set canvas to video's native resolution for maximum quality
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw the current video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to high-quality JPEG (0.95 quality for maximum detail)
      const imageData = canvas.toDataURL('image/jpeg', 0.95);

      console.log('PWA photo captured, resolution:', video.videoWidth, 'x', video.videoHeight);
      console.log('PWA photo size:', Math.round(imageData.length / 1024), 'KB');
      
      onCapture(imageData);
    } catch (error) {
      console.error('PWA capture error:', error);
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

  // Cleanup camera resources
  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log('Stopping PWA track:', track);
        track.stop();
      });
      streamRef.current = null;
      setStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    // Unlock orientation when cleaning up
    if (isPWA && screen.orientation && 'unlock' in screen.orientation) {
      (screen.orientation as any).unlock();
    }
    
    // Reset starting flag
    isStartingRef.current = false;
    setStatus('Starting camera...');
  }, [isPWA]);

  // Handle orientation changes for PWA
  useEffect(() => {
    const handleOrientationChange = () => {
      // In PWA mode, use more sophisticated orientation detection
      if (isPWA) {
        const orientation = screen.orientation?.angle || window.orientation || 0;
        const isCurrentlyLandscape = Math.abs(orientation) === 90;
        setIsLandscape(isCurrentlyLandscape);
        console.log('PWA orientation changed:', orientation, 'landscape:', isCurrentlyLandscape);
      } else {
        // Fallback for browser mode
        const isCurrentlyLandscape = window.innerWidth > window.innerHeight;
        setIsLandscape(isCurrentlyLandscape);
        console.log('Browser orientation changed, landscape:', isCurrentlyLandscape);
      }
    };

    if (isPWA && screen.orientation) {
      screen.orientation.addEventListener('change', handleOrientationChange);
    } else {
      window.addEventListener('resize', handleOrientationChange);
      window.addEventListener('orientationchange', handleOrientationChange);
    }
    
    handleOrientationChange();
    
    return () => {
      if (isPWA && screen.orientation) {
        screen.orientation.removeEventListener('change', handleOrientationChange);
      } else {
        window.removeEventListener('resize', handleOrientationChange);
        window.removeEventListener('orientationchange', handleOrientationChange);
      }
    };
  }, [isPWA]);

  // Start camera on mount and cleanup on unmount
  useEffect(() => {
    startCamera();
    return () => {
      cleanup();
    };
  }, []); // Empty dependency array - only run once on mount

  return (
    <div className="h-full w-full relative bg-black overflow-hidden">
      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* PWA Status Indicator */}
      {isPWA && (
        <div className="absolute top-2 right-2 z-20">
          <div className="bg-green-500 text-white text-xs px-2 py-1 rounded">
            PWA
          </div>
        </div>
      )}
      
      {/* Status indicator */}
      <div className={`absolute z-10 transition-all duration-300 ${
        isLandscape 
          ? 'top-16 left-4 right-24'
          : 'top-16 left-4 right-4'
      }`}>
        <p className="text-white text-sm bg-black bg-opacity-50 px-3 py-1 rounded">
          {status}
        </p>
      </div>

      {/* Video - PWA optimized with hardware acceleration */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          transform: 'none',
          transition: 'none',
          touchAction: 'none',
          userSelect: 'none',
          // PWA-optimized viewport
          // Enhanced hardware acceleration for PWA
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          perspective: '1000px',
          // PWA-specific optimizations
          WebkitTransform: 'translateZ(0)',
          WebkitBackfaceVisibility: 'hidden'
        }}
        playsInline
        webkit-playsinline="true"
        muted
        controls={false}
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Capture Button - PWA native positioning */}
      <div className={`absolute z-20 transition-all duration-300 ease-in-out ${
        isLandscape 
          ? 'right-8 top-1/2 transform -translate-y-1/2'
          : 'bottom-8 left-1/2 transform -translate-x-1/2'
      }`}>
        <button
          onClick={capturePhoto}
          disabled={!stream || isCapturing}
          className={`
            w-20 h-20 rounded-full border-4 transition-all duration-200 shadow-2xl
            flex items-center justify-center text-3xl relative
            ${!stream || isCapturing
              ? 'border-gray-400 bg-gray-300 opacity-50 cursor-not-allowed'
              : 'border-white bg-red-500 hover:bg-red-600 active:scale-95 text-white'
            }
          `}
          aria-label="Capture photo"
        >
          {isCapturing ? (
            <div className="animate-spin w-8 h-8 border-3 border-white border-t-transparent rounded-full"></div>
          ) : (
            <span>📷</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default CameraCapture;