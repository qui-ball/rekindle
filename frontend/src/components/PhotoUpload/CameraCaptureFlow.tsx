/**
 * CameraCaptureFlow Component
 * 
 * Manages the camera capture flow:
 * 1. Camera capture page with dynamic aspect ratio layout
 * 2. Smart photo detection using JScanify
 * 3. Photo preview with accept/retake options
 * 4. Direct capture to full image (no cropping)
 * 
 * Features:
 * - Dynamic aspect ratio camera interface matching native camera apps
 * - Portrait: 3:4 aspect ratio (taller) - both mobile and desktop
 * - Landscape: 4:3 aspect ratio (wider) - both mobile and desktop
 * - Portrait: camera at top, controls at bottom
 * - Landscape: camera at left, controls at right
 * - Smart photo boundary detection using JScanify
 * - Photo preview with detection results
 * - Quality indicators for lighting and focus
 * - Proper cancel handling
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CameraCapture } from './CameraCapture';
import { CameraCaptureProps } from './types';
import { SmartPhotoDetector } from '../../services/SmartPhotoDetector';
import { SmartCroppingInterface } from './SmartCroppingInterface';
import { UploadPreview } from './UploadPreview';
import type { CornerPoints } from '../../types/jscanify';

type CaptureState = 'capturing' | 'preview' | 'uploadPreview';

interface CameraCaptureFlowProps extends Omit<CameraCaptureProps, 'onCapture'> {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageData: string) => void;
  closeOnEscape?: boolean;
}

export const CameraCaptureFlow: React.FC<CameraCaptureFlowProps> = ({
  isOpen,
  onClose,
  onCapture,
  onError,
  closeOnEscape = true,
  facingMode = 'environment'
  // aspectRatio removed for native camera behavior
}) => {
  const [captureState, setCaptureState] = useState<CaptureState>('capturing');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [croppedCornerPoints, setCroppedCornerPoints] = useState<CornerPoints | null>(null);
  const [smartDetector, setSmartDetector] = useState<SmartPhotoDetector | null>(null);
  const [detectionResult, setDetectionResult] = useState<{
    detected: boolean;
    confidence: number;
    cropArea: { x: number; y: number; width: number; height: number };
    cornerPoints?: {
      topLeftCorner: { x: number; y: number };
      topRightCorner: { x: number; y: number };
      bottomLeftCorner: { x: number; y: number };
      bottomRightCorner: { x: number; y: number };
    };
    source?: 'jscanify' | 'fallback' | 'generic';
    metrics?: {
      areaRatio: number;
      edgeRatio: number;
      minDistance: number;
      imageSize: string;
      detectedSize: string;
    };
  } | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [cameraQuality, setCameraQuality] = useState({ lighting: 'analyzing', focus: 'analyzing' });
  const cropButtonRef = useRef<(() => void) | null>(null);

  // Initialize SmartPhotoDetector only on client-side
  useEffect(() => {
    const initializeDetector = async () => {
      try {
        const detector = new SmartPhotoDetector();
        await detector.initialize();
        setSmartDetector(detector);
      } catch (error) {
        console.warn('⚠️ SmartPhotoDetector initialization failed:', error);
        setSmartDetector(null);
      }
    };

    initializeDetector();
  }, []);

  // Handle orientation changes and device detection
  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    const detectMobile = () => {
      // Detect mobile devices using user agent and screen size
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      const isMobileScreen = window.innerWidth <= 768; // Common mobile breakpoint
      setIsMobile(isMobileUA || isMobileScreen);
    };

    // Set initial values
    handleResize();
    detectMobile();

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Monitor camera quality from CameraCapture component
  useEffect(() => {
    const checkQuality = () => {
      const windowWithCamera = window as Window & { 
        cameraQuality?: { lighting: string; focus: string };
      };
      if (windowWithCamera.cameraQuality) {
        setCameraQuality(windowWithCamera.cameraQuality);
      }
    };

    const interval = setInterval(checkQuality, 100); // Check every 100ms for responsive updates
    return () => clearInterval(interval);
  }, []);

  // Handle close - reset state and close modal
  const handleClose = useCallback(() => {
    setCaptureState('capturing');
    setCapturedImage(null);
    onClose();
  }, [onClose]);

  // Handle escape key
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (closeOnEscape && event.key === 'Escape') {
      handleClose();
    }
  }, [closeOnEscape, handleClose]);

  // Handle camera capture - go to preview state with smart detection
  const handleCameraCapture = useCallback(async (imageData: string) => {
    setCapturedImage(imageData);
    
    // Always try smart detection if detector exists (let it handle its own fallbacks)
    if (smartDetector) {
      try {
        setIsDetecting(true);
        
        // Create a temporary image to get dimensions
        const img = new Image();
        img.onload = async () => {
          try {
            const detection = await smartDetector.detectPhotoBoundaries(
              imageData,
              img.naturalWidth,
              img.naturalHeight
            );
            
            setDetectionResult(detection);
          } catch (error) {
            console.error('❌ Smart detection failed:', error);
            setDetectionResult(null);
          } finally {
            setIsDetecting(false);
            setCaptureState('preview');
          }
        };
        
        img.onerror = () => {
          console.error('❌ Failed to load image for detection');
          setDetectionResult(null);
          setIsDetecting(false);
          setCaptureState('preview');
        };
        
        img.src = imageData;
      } catch (error) {
        console.error('❌ Smart detection error:', error);
        setDetectionResult(null);
        setIsDetecting(false);
        setCaptureState('preview');
      }
    } else {
      console.log('📋 SmartPhotoDetector not available - skipping detection');
      setDetectionResult(null);
      setCaptureState('preview');
    }
  }, [smartDetector]);

  // Handle camera errors
  const handleCameraError = useCallback((error: { code: string; message: string; name: string }) => {
    if (error.code === 'USER_CANCELLED') {
      handleClose(); // Close modal on user cancellation
    } else {
      onError(error); // Pass other errors to parent
    }
  }, [onError, handleClose]);


  const handleCropComplete = useCallback((croppedImageData: string, cornerPoints?: CornerPoints) => {
    console.log('✅ Crop completed - proceeding to upload preview');
    
    // Store cropped image and corner points for perspective correction
    setCroppedImage(croppedImageData);
    
    // Use provided corner points or fall back to detection result
    const points = cornerPoints || detectionResult?.cornerPoints;
    
    if (points) {
      setCroppedCornerPoints(points);
      setCaptureState('uploadPreview');
    } else {
      // No corner points available - skip perspective correction and upload directly
      console.log('⚠️ No corner points available - uploading cropped image directly');
      onCapture(croppedImageData);
      handleClose();
    }
  }, [detectionResult, onCapture, handleClose]);

  const handleUploadPreviewConfirm = useCallback((correctedImage: string) => {
    console.log('✅ Upload preview confirmed - submitting corrected image');
    onCapture(correctedImage);
    handleClose();
  }, [onCapture, handleClose]);

  const handleUploadPreviewCancel = useCallback(() => {
    console.log('🔄 Retaking from upload preview - returning to camera');
    setCapturedImage(null);
    setCroppedImage(null);
    setCroppedCornerPoints(null);
    setDetectionResult(null);
    setCaptureState('capturing');
  }, []);





  // Set up event listeners
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen, handleKeyDown]);

  // Calculate appropriate aspect ratio based on device and orientation
  const getAspectRatio = useCallback(() => {
    // Use more flexible aspect ratios that work better with actual camera hardware
    // Desktop cameras often don't support exact 3:4 ratios, so we use more common ratios
    return isLandscape ? 4/3 : 3/4; // Keep the target ratio, but let the camera use its native ratio
  }, [isLandscape]);

  const getAspectRatioClass = useCallback(() => {
    // Both mobile and desktop: 3:4 for portrait, 4:3 for landscape
    return isLandscape ? 'aspect-[4/3]' : 'aspect-[3/4]';
  }, [isLandscape]);

  if (!isOpen) {
    return null;
  }

  // Grid-based control area component - 5x5 grid covering entire Control Area
  const ControlGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
      <div className={`fixed z-20 ${
        isLandscape 
          ? 'top-0 bottom-0' // Landscape: right side, full height
          : 'left-0 right-0' // Portrait: bottom, full width
      }`} style={{
        // Position Control Area to start exactly where camera view ends
        // Based on actual testing: camera takes up 70% of screen on mobile
        // Use fixed positioning to ensure consistent coordinates regardless of content
        [isLandscape ? 'left' : 'top']: isLandscape 
          ? '70vw' // Landscape: camera takes 70% of viewport width
          : '70vh', // Portrait: camera takes 70% of viewport height
        // Control Area takes remaining space
        width: isLandscape ? '30vw' : '100vw', // Remaining 30% for landscape, full width for portrait
        height: isLandscape ? '100vh' : '30vh', // Full height for landscape, remaining 30% for portrait
        // Control Area styling (no debugging visuals)
        // Ensure no overflow or cutoff
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}>
        {/* 5x5 Grid container covering entire Control Area */}
        <div className={`h-full w-full grid grid-cols-5 grid-rows-5`} style={{
          // Force full coverage with explicit dimensions
          height: '100%',
          width: '100%',
          minHeight: '100%',
          minWidth: '100%',
          // Grid styling (no visual indicators)
          // Ensure grid items fill their cells exactly
          gridTemplateRows: 'repeat(5, 1fr)',
          gridTemplateColumns: 'repeat(5, 1fr)',
          // Force grid items to fill their cells
          alignItems: 'stretch',
          justifyItems: 'stretch'
        }}>
          {children}
        </div>
      </div>
    );
  };

  const renderCaptureView = () => {
    return (
      <div className="h-screen w-screen bg-black relative overflow-hidden">
        {/* Camera View Area - fills screen with dynamic aspect ratio positioning */}
        <div className={`absolute ${
          isLandscape 
            ? 'left-0 top-0 h-full' // Landscape: starts from left edge, full height
            : 'top-0 left-0 w-full'  // Portrait: starts from top edge, full width
        } ${getAspectRatioClass()}`}>
          <CameraCapture
            onCapture={handleCameraCapture}
            onError={handleCameraError}
            facingMode={facingMode}
            aspectRatio={getAspectRatio()}
            isLandscape={isLandscape}
            isMobile={isMobile}
          />
        </div>

        {/* Overlaid Header - centered title and right-aligned close button */}
        <div className="absolute top-6 left-0 right-0 z-20 flex justify-between items-center px-6">
          <div className="flex-1 flex justify-center">
            <h1 className="text-sm font-semibold text-white bg-black bg-opacity-70 px-3 py-1 rounded shadow-lg">
              Take Photo
            </h1>
          </div>
          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 flex items-center justify-center text-white shadow-lg ml-4"
            aria-label="Close camera"
          >
            ✕
          </button>
        </div>

        {/* 5x5 Grid-based Control Area */}
        <ControlGrid>
          {/* Empty cells for grid structure */}
          <div style={{ width: '100%', height: '100%' }}></div>
          <div style={{ width: '100%', height: '100%' }}></div>
          <div style={{ width: '100%', height: '100%' }}></div>
          <div style={{ width: '100%', height: '100%' }}></div>
          <div style={{ width: '100%', height: '100%' }}></div>
          
          <div style={{ width: '100%', height: '100%' }}></div>
          <div style={{ width: '100%', height: '100%' }}></div>
          <div style={{ width: '100%', height: '100%' }}></div>
          <div style={{ width: '100%', height: '100%' }}></div>
          <div style={{ width: '100%', height: '100%' }}></div>
          
          {/* Row 3 - Center row with quality indicators and capture button */}
          {/* Lighting Quality Indicator - positioned in Row 3, Col 1 (portrait) or Row 5, Col 3 (landscape) */}
          <div className="flex items-center justify-center relative" style={{ 
            width: '100%', 
            height: '100%',
            gridRow: isLandscape ? '5' : '3',
            gridColumn: isLandscape ? '3' : '1'
          }}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
              cameraQuality.lighting === 'good' 
                ? 'bg-green-500 bg-opacity-70' 
                : cameraQuality.lighting === 'poor' 
                  ? 'bg-red-500 bg-opacity-70' 
                  : 'bg-yellow-500 bg-opacity-70'
            }`}>
              <div className="w-4 h-4 text-white text-xs flex items-center justify-center">
                💡
              </div>
            </div>
          </div>
          
          {/* Focus Quality Indicator - positioned in Row 3, Col 2 (portrait) or Row 4, Col 3 (landscape) */}
          <div className="flex items-center justify-center relative" style={{ 
            width: '100%', 
            height: '100%',
            gridRow: isLandscape ? '4' : '3',
            gridColumn: isLandscape ? '3' : '2'
          }}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
              cameraQuality.focus === 'good' 
                ? 'bg-green-500 bg-opacity-70' 
                : cameraQuality.focus === 'poor' 
                  ? 'bg-red-500 bg-opacity-70' 
                  : 'bg-yellow-500 bg-opacity-70'
            }`}>
              <div className="w-4 h-4 text-white text-xs flex items-center justify-center">
                🎯
              </div>
            </div>
          </div>
          
          {/* Capture Button - positioned in Row 3, Col 3 (center) */}
          <div className="flex items-center justify-center relative" style={{ 
            width: '100%', 
            height: '100%',
            gridRow: isLandscape ? '3' : '3',
            gridColumn: isLandscape ? '3' : '3'
          }}>
            <button
              onClick={() => {
                // Trigger capture on CameraCapture component via global function
                const windowWithCapture = window as Window & { triggerCameraCapture?: () => void };
                if (windowWithCapture.triggerCameraCapture) {
                  windowWithCapture.triggerCameraCapture();
                }
              }}
              className={`w-16 h-16 rounded-full border-4 border-white active:scale-95 
                flex items-center justify-center text-2xl relative shadow-2xl transition-all duration-300 ${
                cameraQuality.lighting === 'good' && cameraQuality.focus === 'good'
                  ? 'bg-green-500 hover:bg-green-600'  // Both good = green
                  : cameraQuality.lighting === 'poor' || cameraQuality.focus === 'poor'
                    ? 'bg-red-500 hover:bg-red-600'    // Any poor = red
                    : 'bg-yellow-500 hover:bg-yellow-600' // Analyzing = yellow
              }`}
              aria-label="Capture photo"
            >
              <span className="text-white">📷</span>
            </button>
          </div>
          
          <div style={{ width: '100%', height: '100%' }}></div>
          <div style={{ width: '100%', height: '100%' }}></div>
          
          <div style={{ width: '100%', height: '100%' }}></div>
          <div style={{ width: '100%', height: '100%' }}></div>
          <div style={{ width: '100%', height: '100%' }}></div>
          <div style={{ width: '100%', height: '100%' }}></div>
          <div style={{ width: '100%', height: '100%' }}></div>
          
          <div style={{ width: '100%', height: '100%' }}></div>
          <div style={{ width: '100%', height: '100%' }}></div>
          <div style={{ width: '100%', height: '100%' }}></div>
          <div style={{ width: '100%', height: '100%' }}></div>
          <div style={{ width: '100%', height: '100%' }}></div>
        </ControlGrid>
      </div>
    );
  };

  // Removed separate cropping view - integrated into preview

  const renderPreviewView = () => {
    if (!capturedImage) return null;

    // Always show SmartCroppingInterface to allow manual cropping
    // Create a fallback detection result if none exists
    // Note: Not providing cropArea will trigger SmartCroppingInterface's final fallback
    // which creates an 80% centered crop area (Requirement 12.6)
    const cropDetectionResult = detectionResult || {
      detected: false,
      confidence: 0,
      // Don't provide cropArea to trigger final fallback (80% centered crop - Req 12.6)
      cropArea: undefined as unknown as { x: number; y: number; width: number; height: number },
      source: 'fallback' as const
    };

    return (
      <div className="h-screen w-screen bg-black relative overflow-hidden">
        {/* Preview Image with Smart Cropping - matches camera view aspect ratio for visual continuity */}
        <div className={`absolute ${
          isLandscape 
            ? 'left-0 top-0 h-full' // Landscape: starts from left edge, full height (same as camera)
            : 'top-0 left-0 w-full'  // Portrait: starts from top edge, full width (same as camera)
        } ${getAspectRatioClass()}`}>
          <SmartCroppingInterface
            image={capturedImage}
            detectionResult={{
              ...cropDetectionResult,
              cornerPoints: cropDetectionResult.cornerPoints ? {
                topLeft: cropDetectionResult.cornerPoints.topLeftCorner,
                topRight: cropDetectionResult.cornerPoints.topRightCorner,
                bottomLeft: cropDetectionResult.cornerPoints.bottomLeftCorner,
                bottomRight: cropDetectionResult.cornerPoints.bottomRightCorner
              } : undefined
            }}
            onCropComplete={handleCropComplete}
            onCancel={handleClose}
            isLandscape={isLandscape}
            aspectRatio={getAspectRatio()}
            isMobile={isMobile}
            cropButtonRef={cropButtonRef}
          />
        </div>

        {/* Control Area with Crop Button */}
        <ControlGrid>
          {/* Row 3, Column 3 (center of 5x5 grid) */}
          <div className="col-start-3 row-start-3 flex items-center justify-center">
            <button
              onClick={() => cropButtonRef.current?.()}
              className="w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-2xl transition-colors shadow-lg flex items-center justify-center"
              aria-label="Apply crop"
            >
              ✓
            </button>
          </div>
        </ControlGrid>

        {/* Overlaid Header - centered title and right-aligned close button */}
        <div className="absolute top-6 left-0 right-0 z-20 flex justify-between items-center px-6">
          <div className="flex-1 flex justify-center">
            <h1 className="text-sm font-semibold text-white bg-black bg-opacity-70 px-3 py-1 rounded shadow-lg">
              {detectionResult && (detectionResult.detected || detectionResult.cornerPoints) ? 'Smart Crop' : 'Crop Photo'}
            </h1>
          </div>
          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 flex items-center justify-center text-white shadow-lg ml-4"
            aria-label="Close preview"
          >
            ✕
          </button>
        </div>

        {/* Smart Detection Status */}
        {isDetecting && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-20">
            <div className="bg-blue-500 bg-opacity-90 text-white px-4 py-2 rounded-lg flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">Analyzing photo...</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderUploadPreviewView = () => {
    if (!croppedImage || !croppedCornerPoints) {
      console.error('❌ Upload preview state without required data');
      return null;
    }

    return (
      <UploadPreview
        originalImage={croppedImage}
        cornerPoints={croppedCornerPoints}
        onConfirm={handleUploadPreviewConfirm}
        onCancel={handleUploadPreviewCancel}
        closeOnEscape={closeOnEscape}
      />
    );
  };

  const renderCurrentView = () => {
    switch (captureState) {
      case 'capturing':
        return renderCaptureView();
      case 'preview':
        return renderPreviewView();
      case 'uploadPreview':
        return renderUploadPreviewView();
      default:
        return renderCaptureView();
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 bg-gray-900 camera-fullscreen">
      {renderCurrentView()}
    </div>
  );

  // Render in portal to ensure proper z-index layering
  return createPortal(modalContent, document.body);
};

export default CameraCaptureFlow;