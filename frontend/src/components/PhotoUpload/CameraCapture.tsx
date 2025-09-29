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
  const [lightingQuality, setLightingQuality] = useState<'good' | 'poor' | 'analyzing'>('analyzing');
  const [focusQuality, setFocusQuality] = useState<'good' | 'poor' | 'analyzing'>('analyzing');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isStartingRef = useRef<boolean>(false);

  // Detect PWA mode
  useEffect(() => {
    const checkPWA = () => {
      const isPWAMode = window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as Navigator & { standalone?: boolean }).standalone ||
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

  // Set initial zoom to wide angle (1x)
  const setInitialZoom = useCallback(async () => {
    if (!streamRef.current) return;

    try {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (!videoTrack) return;

      // Check if zoom is supported
      const capabilities = videoTrack.getCapabilities();
      const capabilitiesWithZoom = capabilities as MediaTrackCapabilities & { 
        zoom?: { min: number; max: number; step: number } 
      };
      
      if ('zoom' in capabilities && capabilitiesWithZoom.zoom) {
        console.log('Zoom capabilities:', capabilitiesWithZoom.zoom);
        
        // Set zoom to minimum (widest angle)
        await videoTrack.applyConstraints({
          advanced: [{
            zoom: capabilitiesWithZoom.zoom.min || 1.0
          } as MediaTrackConstraintSet & { zoom: number }]
        });
        
        console.log('Zoom set to:', capabilitiesWithZoom.zoom.min || 1.0);
      } else {
        console.log('Zoom not supported on this device');
      }
    } catch (error) {
      console.warn('Failed to set initial zoom:', error);
      // Don't throw error, zoom is not critical
    }
  }, []);

  // Quality analysis for lighting and focus
  const startQualityAnalysis = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const analyzeQuality = () => {
      if (!videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx || video.readyState < 2) return;

      // Set canvas to a small size for analysis (performance)
      canvas.width = 160;
      canvas.height = 120;

      // Draw current frame for analysis
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Analyze lighting (brightness)
      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        totalBrightness += (r + g + b) / 3;
      }
      const avgBrightness = totalBrightness / (data.length / 4);
      
      // Update lighting quality (good range: 80-180)
      setLightingQuality(avgBrightness > 60 && avgBrightness < 200 ? 'good' : 'poor');

      // Analyze focus (improved edge detection for sharpness)
      let edgeStrength = 0;
      let edgeCount = 0;
      const width = canvas.width;
      const height = canvas.height;
      
      // Check both horizontal and vertical edges for better focus detection
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = (y * width + x) * 4;
          const current = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          
          // Check horizontal edge
          const right = (data[idx + 4] + data[idx + 5] + data[idx + 6]) / 3;
          const horizontalEdge = Math.abs(current - right);
          
          // Check vertical edge
          const below = (data[idx + width * 4] + data[idx + width * 4 + 1] + data[idx + width * 4 + 2]) / 3;
          const verticalEdge = Math.abs(current - below);
          
          const maxEdge = Math.max(horizontalEdge, verticalEdge);
          if (maxEdge > 10) { // Only count significant edges
            edgeStrength += maxEdge;
            edgeCount++;
          }
        }
      }
      
      const avgEdgeStrength = edgeCount > 0 ? edgeStrength / edgeCount : 0;
      
      // Update focus quality with more reasonable thresholds
      setFocusQuality(avgEdgeStrength > 25 ? 'good' : 'poor');
    };

    // Run analysis every 500ms
    const interval = setInterval(analyzeQuality, 500);
    
    // Cleanup interval when component unmounts
    return () => clearInterval(interval);
  }, []);

  // Start camera with PWA optimizations and progressive fallback
  const startCamera = useCallback(async () => {
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
      
      // OPTIMIZED CAMERA CONSTRAINTS: Prioritize 16:9 aspect ratio to minimize black bars
      const constraintOptions = [
        // Try maximum quality with 16:9 aspect ratio (best for full-screen display)
        {
          video: {
            facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            aspectRatio: { ideal: 16/9 },
            frameRate: { ideal: 30 }
          },
          audio: false
        },
        // High quality 16:9 fallback
        {
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            aspectRatio: { ideal: 16/9 },
            frameRate: { ideal: 30 }
          },
          audio: false
        },
        // Medium quality 16:9 fallback
        {
          video: {
            facingMode,
            width: { ideal: 960 },
            height: { ideal: 540 },
            aspectRatio: { ideal: 16/9 }
          },
          audio: false
        },
        // Standard HD 16:9 fallback
        {
          video: {
            facingMode,
            width: { ideal: 854 },
            height: { ideal: 480 },
            aspectRatio: { ideal: 16/9 }
          },
          audio: false
        },
        // 4:3 fallback only if 16:9 not supported (older devices)
        {
          video: {
            facingMode,
            width: { ideal: 640 },
            height: { ideal: 480 },
            aspectRatio: { ideal: 4/3 }
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
          
          // If this is an OverconstrainedError or TypeError (unsupported constraints), try the next fallback
          if (error instanceof Error && (
            error.name === 'OverconstrainedError' || 
            error.name === 'TypeError' ||
            error.message.includes('constraints are not supported')
          )) {
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
          setStatus('Camera ready');
          
          // Log actual resolution and aspect ratio achieved
          if (videoRef.current) {
            const width = videoRef.current.videoWidth;
            const height = videoRef.current.videoHeight;
            const aspectRatio = width / height;
            const aspectRatioString = aspectRatio.toFixed(2);
            
            console.log('📹 Camera initialized:', {
              resolution: `${width}x${height}`,
              aspectRatio: aspectRatioString,
              aspectRatioType: aspectRatio > 1.7 ? '16:9' : aspectRatio > 1.4 ? '3:2' : '4:3'
            });
            
            // Log if we're using a 4:3 aspect ratio (which causes more black bars)
            if (aspectRatio < 1.4) {
              console.warn('⚠️ Camera using 4:3 aspect ratio - this may cause black bars in cropping interface');
            }
          }
          
          // Try to set zoom to 1x (wide angle) after initialization
          setInitialZoom();
          
          // Start quality analysis
          startQualityAnalysis();
          
          // PWA-specific orientation lock
          if (isPWA && screen.orientation && 'lock' in screen.orientation) {
            (screen.orientation as ScreenOrientation & { lock: (orientation: string) => Promise<void> })
              .lock('any').catch((error: Error) => {
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
          setStatus('Camera ready (tap to play)');
        }
      }
      
    } catch (err) {
      console.error('PWA camera error:', err);
      const error = err as Error;
      handleCameraError(error);
    } finally {
      isStartingRef.current = false;
    }
  }, [facingMode, handleCameraError, isPWA, setInitialZoom, startQualityAnalysis]);





  // Capture photo with PWA optimizations
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: false });

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
      (screen.orientation as ScreenOrientation & { unlock: () => void }).unlock();
    }
    
    // Reset starting flag and quality indicators
    isStartingRef.current = false;
    setStatus('Starting camera...');
    setLightingQuality('analyzing');
    setFocusQuality('analyzing');
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
    return cleanup;
  }, [startCamera, cleanup]);

  return (
    <div className="h-full w-full relative bg-black overflow-hidden">
      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Status Indicators */}
      <div className="absolute top-2 right-2 z-20 flex flex-col gap-2">
        {isPWA && (
          <div className="bg-green-500 text-white text-xs px-2 py-1 rounded">
            PWA
          </div>
        )}
        {!stream && (
          <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded">
            {status}
          </div>
        )}
      </div>
      
      {/* Quality Indicators - aligned with capture button center */}
      {stream && (
        <div className={`absolute z-10 transition-all duration-300 ${
          isLandscape 
            ? 'right-6 top-1/2 transform -translate-y-1/2 translate-y-24 flex flex-col gap-2'
            : 'bottom-6 left-1/2 transform -translate-x-1/2 -translate-x-24 flex gap-2'
        }`}>
          {/* Lighting Quality Indicator */}
          <div className="flex items-center gap-1 bg-black bg-opacity-50 px-2 py-1 rounded text-white text-xs">
            <div className={`w-2 h-2 rounded-full ${
              lightingQuality === 'good' ? 'bg-green-400' : 
              lightingQuality === 'poor' ? 'bg-red-400' : 'bg-yellow-400'
            }`}></div>
            <span>Light</span>
          </div>
          
          {/* Focus Quality Indicator */}
          <div className="flex items-center gap-1 bg-black bg-opacity-50 px-2 py-1 rounded text-white text-xs">
            <div className={`w-2 h-2 rounded-full ${
              focusQuality === 'good' ? 'bg-green-400' : 
              focusQuality === 'poor' ? 'bg-red-400' : 'bg-yellow-400'
            }`}></div>
            <span>Focus</span>
          </div>
        </div>
      )}

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

      {/* Capture Button - PWA native positioning, safely inside screen bounds */}
      <div className={`absolute z-20 transition-all duration-300 ease-in-out ${
        isLandscape 
          ? 'right-6 top-1/2 transform -translate-y-1/2'
          : 'bottom-6 left-1/2 transform -translate-x-1/2'
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