/**
 * CameraCapture Component
 * 
 * Native PWA-optimized camera interface with dynamic aspect ratio matching native camera apps.
 * Designed to fit within a parent container with controls positioned outside the camera view.
 * 
 * Features:
 * - Dynamic aspect ratio camera view (3:4 portrait, 4:3 landscape) - both mobile and desktop
 * - Maximum device resolution within aspect ratio constraints
 * - PWA compatible with iOS and Android optimization
 * - Quality indicators positioned within camera view
 * - Capture button positioned at bottom of camera view
 * - Back camera default for physical photo capture
 * - PWA mode detection and optimization
 * - High-quality JPEG capture (0.95 quality) with no compression
 * - Enhanced orientation handling for PWA
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { CameraCaptureProps, CameraError } from './types';

interface CameraCaptureExtendedProps extends CameraCaptureProps {
  isLandscape?: boolean;
  isMobile?: boolean;
  onVideoElementReady?: (videoElement: HTMLVideoElement) => void;
}

export const CameraCapture: React.FC<CameraCaptureExtendedProps> = ({
  onCapture,
  onError,
  facingMode = 'environment', // Back camera default
  aspectRatio = 3/4, // Default to 3/4 for natural photo capture
  onVideoElementReady
  // isLandscape and isMobile are available for future use
}) => {
  const [status, setStatus] = useState<string>('Starting camera...');
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [isPWA, setIsPWA] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [lightingQuality, setLightingQuality] = useState<'good' | 'poor' | 'analyzing'>('analyzing');
  const [focusQuality, setFocusQuality] = useState<'good' | 'poor' | 'analyzing'>('analyzing');
  const [, setActualAspectRatio] = useState<number>(aspectRatio);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isStartingRef = useRef<boolean>(false);
  const captureRef = useRef<() => void>();

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

  // Notify parent when video element is ready
  useEffect(() => {
    if (videoRef.current && onVideoElementReady) {
      onVideoElementReady(videoRef.current);
    }
  }, [onVideoElementReady]);

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
      
      console.log('Starting PWA-optimized camera with aspect ratio:', aspectRatio);
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported');
      }
      
      // NATIVE CAMERA CONSTRAINTS: Prioritize high quality over exact aspect ratio
      const constraintOptions = [
        // Try maximum quality with flexible aspect ratio
        {
          video: {
            facingMode,
            width: { ideal: 1920, max: 4096 },
            height: { ideal: 1080, max: 2160 },
            frameRate: { ideal: 30 }
          },
          audio: false
        },
        // High quality fallback
        {
          video: {
            facingMode,
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: false
        },
        // Standard fallback
        {
          video: {
            facingMode,
            width: { ideal: 1024, max: 1280 },
            height: { ideal: 768, max: 720 },
            frameRate: { ideal: 30 }
          },
          audio: false
        },
        // Basic fallback
        {
          video: {
            facingMode,
            width: { ideal: 800, max: 1024 },
            height: { ideal: 600, max: 768 },
            frameRate: { ideal: 30 }
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
          console.log(`✅ Camera constraints successful on attempt ${i + 1} with aspect ratio:`, aspectRatio);
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
            const actualAspectRatio = width / height;
            const aspectRatioString = actualAspectRatio.toFixed(2);
            
            console.log('📹 Camera initialized:', {
              resolution: `${width}x${height}`,
              aspectRatio: aspectRatioString,
              aspectRatioType: actualAspectRatio > 1.7 ? '16:9' : actualAspectRatio > 1.4 ? '3:2' : '4:3'
            });
            
            // Update the aspect ratio to match the actual camera
            setActualAspectRatio(actualAspectRatio);
            
            // Log the actual aspect ratio achieved
            console.log(`📐 Camera using ${aspectRatioString} aspect ratio (${actualAspectRatio > 1.7 ? '16:9' : actualAspectRatio > 1.4 ? '3:2' : '4:3'})`);
            console.log('ℹ️ SmartCroppingInterface will automatically crop to match the camera view aspect ratio');
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
  }, [facingMode, handleCameraError, isPWA, setInitialZoom, startQualityAnalysis, aspectRatio]);





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

      // Calculate crop dimensions to match desired aspect ratio
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      const videoAspectRatio = videoWidth / videoHeight;
      
      let cropWidth, cropHeight, cropX, cropY;
      
      if (Math.abs(videoAspectRatio - aspectRatio) < 0.01) {
        // Video already matches desired aspect ratio
        cropWidth = videoWidth;
        cropHeight = videoHeight;
        cropX = 0;
        cropY = 0;
      } else if (videoAspectRatio > aspectRatio) {
        // Video is wider than desired - crop width
        cropHeight = videoHeight;
        cropWidth = Math.round(videoHeight * aspectRatio);
        cropX = Math.round((videoWidth - cropWidth) / 2);
        cropY = 0;
      } else {
        // Video is taller than desired - crop height
        cropWidth = videoWidth;
        cropHeight = Math.round(videoWidth / aspectRatio);
        cropX = 0;
        cropY = Math.round((videoHeight - cropHeight) / 2);
      }

      // Set canvas to cropped dimensions
      canvas.width = cropWidth;
      canvas.height = cropHeight;

      // Draw the cropped video frame
      ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      // Convert to high-quality JPEG (0.95 quality for maximum detail)
      const imageData = canvas.toDataURL('image/jpeg', 0.95);

      console.log('📷 Photo captured:');
      console.log('  Original video:', videoWidth, 'x', videoHeight, `(${videoAspectRatio.toFixed(2)})`);
      console.log('  Desired aspect ratio:', aspectRatio.toFixed(2));
      console.log('  Cropped to:', cropWidth, 'x', cropHeight, `(${(cropWidth/cropHeight).toFixed(2)})`);
      console.log('  Crop area:', `x:${cropX}, y:${cropY}, w:${cropWidth}, h:${cropHeight}`);
      console.log('  Final size:', Math.round(imageData.length / 1024), 'KB');
      
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
  }, [onCapture, onError, isCapturing, aspectRatio]);

  // Expose capture function to parent
  useEffect(() => {
    captureRef.current = capturePhoto;
  }, [capturePhoto]);

  // Expose capture function and quality states globally for parent to access
  useEffect(() => {
    const windowWithCamera = window as Window & { 
      triggerCameraCapture?: () => void;
      cameraQuality?: { lighting: string; focus: string };
    };
    windowWithCamera.triggerCameraCapture = capturePhoto;
    windowWithCamera.cameraQuality = { lighting: lightingQuality, focus: focusQuality };
    return () => {
      delete windowWithCamera.triggerCameraCapture;
      delete windowWithCamera.cameraQuality;
    };
  }, [capturePhoto, lightingQuality, focusQuality]);

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



  // Start camera on mount and cleanup on unmount
  useEffect(() => {
    startCamera();
    return cleanup;
  }, [startCamera, cleanup]);

  return (
    <div className="h-full w-full relative bg-black overflow-hidden">
      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Status indicator - only show when camera is starting */}
      {!stream && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-cozy-accent text-white text-sm font-serif px-4 py-2 rounded-cozy-md">
            {status}
          </div>
        </div>
      )}

      {/* Video - fills the container completely */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          transition: 'none',
          touchAction: 'none',
          userSelect: 'none',
          // Hardware acceleration for smooth performance
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          perspective: '1000px',
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

      {/* Capture loading indicator - shown during capture */}
      {isCapturing && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black bg-opacity-30">
          <div className="animate-spin w-8 h-8 border-3 border-white border-t-transparent rounded-full"></div>
        </div>
      )}
    </div>
  );
};

export default CameraCapture;