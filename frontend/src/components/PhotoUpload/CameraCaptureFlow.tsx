/**
 * CameraCaptureFlow Component
 * 
 * Manages the complete camera capture flow including:
 * 1. Camera capture page with dynamic aspect ratio layout
 * 2. Direct transition to cropping interface
 * 3. Quadrilateral cropping with corner handles
 * 
 * Features:
 * - Dynamic aspect ratio camera interface matching native camera apps
 * - Mobile Portrait: 3:4 aspect ratio (taller)
 * - Mobile Landscape: 4:3 aspect ratio (wider)
 * - Desktop: 4:3 aspect ratio (matches webcams)
 * - Portrait: camera at top, controls at bottom
 * - Landscape: camera at left, controls at right
 * - Direct capture to cropping (no preview step)
 * - Mobile touch support for cropping
 * - Automatic photo boundary detection
 * - Proper cancel handling
 */

import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CameraCapture } from './CameraCapture';
import { QuadrilateralCropper } from './QuadrilateralCropper';
import { CameraCaptureProps, CropArea, CropAreaPixels } from './types';
import { SmartPhotoDetector } from '../../services/SmartPhotoDetector';

type CaptureState = 'capturing' | 'cropping';

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
  const [detectedCropArea, setDetectedCropArea] = useState<CropAreaPixels | null>(null);
  const [smartDetector, setSmartDetector] = useState<SmartPhotoDetector | null>(null);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [cameraQuality, setCameraQuality] = useState({ lighting: 'analyzing', focus: 'analyzing' });

  // Initialize SmartPhotoDetector only on client-side
  useEffect(() => {
    const initializeDetector = async () => {
      try {
        const detector = new SmartPhotoDetector();
        await detector.initialize();
        setSmartDetector(detector);
      } catch (error) {
        console.warn('SmartPhotoDetector initialization failed:', error);
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

  // Handle camera capture - move directly to cropping with photo detection
  const handleCameraCapture = useCallback(async (imageData: string) => {
    setCapturedImage(imageData);
    
    try {
      // Create a temporary image to get dimensions
      const img = new Image();
      img.onload = async () => {
        try {
          let detectedArea;
          
          if (smartDetector && smartDetector.isInitialized()) {
            // Use JScanify-powered smart detection for professional accuracy
            const detection = await smartDetector.detectPhotoBoundaries(
              imageData,
              img.naturalWidth,
              img.naturalHeight
            );
            detectedArea = detection.cropArea;
            
            // Log detection success for debugging
            if (detection.detected && detection.confidence > 0.7) {
              console.log('🎯 Smart photo detection successful with confidence:', detection.confidence);
            }
          } else {
            // Fallback to generic crop area when SmartPhotoDetector is not available
            console.log('📋 Using fallback crop area - SmartPhotoDetector not ready');
            detectedArea = {
              x: Math.round(img.naturalWidth * 0.1),
              y: Math.round(img.naturalHeight * 0.1),
              width: Math.round(img.naturalWidth * 0.8),
              height: Math.round(img.naturalHeight * 0.8)
            };
          }
          
          setDetectedCropArea(detectedArea);
          setCaptureState('cropping');
        } catch (error) {
          console.error('Photo detection failed:', error);
          // Fallback to generic crop area
          setDetectedCropArea({
            x: Math.round(img.naturalWidth * 0.1),
            y: Math.round(img.naturalHeight * 0.1),
            width: Math.round(img.naturalWidth * 0.8),
            height: Math.round(img.naturalHeight * 0.8)
          });
          setCaptureState('cropping');
        }
      };
      
      // Handle image load error
      img.onerror = () => {
        console.error('Failed to load captured image');
        // Still proceed to cropping with default area
        setDetectedCropArea({
          x: 50,
          y: 50,
          width: 200,
          height: 200
        });
        setCaptureState('cropping');
      };
      
      img.src = imageData;
    } catch (error) {
      console.error('Error processing captured image:', error);
      onError({ code: 'PROCESSING_ERROR', message: 'Failed to process captured image', name: 'ProcessingError' });
    }
  }, [smartDetector, onError]);

  // Handle camera errors
  const handleCameraError = useCallback((error: { code: string; message: string; name: string }) => {
    if (error.code === 'USER_CANCELLED') {
      handleClose(); // Close modal on user cancellation
    } else {
      onError(error); // Pass other errors to parent
    }
  }, [onError, handleClose]);

  // Handle crop cancellation - go back to capturing
  const handleCropCancel = useCallback(() => {
    setCapturedImage(null);
    setDetectedCropArea(null);
    setCaptureState('capturing');
  }, []);

  // Handle crop completion
  const handleCropComplete = useCallback(async (croppedArea: CropArea, croppedAreaPixels: CropAreaPixels) => {
    if (!capturedImage) return;

    try {
      // Apply crop to the image using canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const image = new Image();

      image.onload = () => {
        canvas.width = croppedAreaPixels.width;
        canvas.height = croppedAreaPixels.height;

        ctx?.drawImage(
          image,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          croppedAreaPixels.width,
          croppedAreaPixels.height
        );

        const croppedImageData = canvas.toDataURL('image/jpeg', 0.9);
        onCapture(croppedImageData);
        handleClose();
      };

      image.src = capturedImage;
    } catch (error) {
      console.error('Error cropping image:', error);
      onError({ code: 'CROP_ERROR', message: 'Failed to crop image', name: 'CropError' });
    }
  }, [capturedImage, onCapture, handleClose, onError]);





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
    if (isMobile) {
      // Mobile: 3:4 for portrait, 4:3 for landscape
      return isLandscape ? 4/3 : 3/4;
    } else {
      // Desktop: Always 3:4 (more natural for photo capture and restoration)
      return 3/4;
    }
  }, [isMobile, isLandscape]);

  const getAspectRatioClass = useCallback(() => {
    if (isMobile) {
      // Mobile: 3:4 for portrait, 4:3 for landscape
      return isLandscape ? 'aspect-[4/3]' : 'aspect-[3/4]';
    } else {
      // Desktop: Always 3:4
      return 'aspect-[3/4]';
    }
  }, [isMobile, isLandscape]);

  if (!isOpen) {
    return null;
  }

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

        {/* Control Area - positioned based on orientation */}
        <div className={`absolute z-20 ${
          isLandscape 
            ? 'right-0 top-0 bottom-0 w-32 flex flex-col justify-center items-center' // Landscape: right side, vertical center
            : 'bottom-0 left-0 right-0 h-32 flex justify-center items-center'        // Portrait: bottom, horizontal center
        }`}>
          
          {/* Quality Indicators - positioned relative to capture button */}
          <div className={`flex ${
            isLandscape 
              ? 'flex-col gap-4 mb-8' // Landscape: vertical stack, above capture button
              : 'gap-6 mr-20'         // Portrait: horizontal, left of capture button
          }`}>
            {/* Lighting Quality Indicator */}
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
            
            {/* Focus Quality Indicator */}
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

          {/* Capture Button - color reflects quality status */}
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
      </div>
    );
  };

  const renderCroppingView = () => {
    if (!capturedImage) return null;

    return (
      <div className="h-screen w-screen bg-black relative overflow-hidden">
        {/* Cropping Area - matches camera view aspect ratio for visual continuity */}
        <div className={`absolute ${
          isLandscape 
            ? 'left-0 top-0 h-full' // Landscape: starts from left edge, full height (same as camera)
            : 'top-0 left-0 w-full'  // Portrait: starts from top edge, full width (same as camera)
        } ${getAspectRatioClass()}`}>
          <QuadrilateralCropper
            image={capturedImage}
            onCropComplete={handleCropComplete}
            onCancel={handleCropCancel}
            initialCropArea={detectedCropArea || undefined}
            isFullScreen={false}
            alignTop={!isLandscape} // Top align for portrait mode, center for landscape
          />
        </div>

        {/* Overlaid Header - same as camera view for continuity */}
        <div className="absolute top-6 left-0 right-0 z-20 flex justify-between items-center px-6">
          <div className="flex-1 flex justify-center">
            <h1 className="text-sm font-semibold text-white bg-black bg-opacity-70 px-3 py-1 rounded shadow-lg">
              Crop Photo
            </h1>
          </div>
          <button
            onClick={handleCropCancel}
            className="w-10 h-10 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 flex items-center justify-center text-white shadow-lg ml-4"
            aria-label="Cancel cropping"
          >
            ✕
          </button>
        </div>

        {/* Control Area - positioned based on orientation, same as camera view */}
        <div className={`absolute z-20 ${
          isLandscape 
            ? 'right-0 top-0 bottom-0 w-32 flex flex-col justify-center items-center' // Landscape: right side, vertical center
            : 'bottom-0 left-0 right-0 h-32 flex justify-center items-center'        // Portrait: bottom, horizontal center
        }`}>
          
          {/* Placeholder for quality indicators (hidden in crop mode) */}
          <div className={`flex ${
            isLandscape 
              ? 'flex-col gap-4 mb-8' // Landscape: vertical stack, above accept button
              : 'gap-6 mr-20'         // Portrait: horizontal, left of accept button
          }`}>
            {/* Empty space to maintain layout consistency */}
            <div className="w-8 h-8 opacity-0"></div>
            <div className="w-8 h-8 opacity-0"></div>
          </div>

          {/* Accept Crop Button - same position as capture button for continuity */}
          <button
            onClick={() => {
              // Trigger crop completion - we'll need to expose this from QuadrilateralCropper
              // For now, we'll use a simple approach
              if (detectedCropArea) {
                handleCropComplete({ x: 0, y: 0, width: 1, height: 1 }, detectedCropArea);
              }
            }}
            className="w-16 h-16 rounded-full border-4 border-white bg-green-500 hover:bg-green-600 active:scale-95 
              flex items-center justify-center text-2xl relative shadow-2xl transition-all duration-300"
            aria-label="Accept crop"
          >
            <span className="text-white">✓</span>
          </button>
        </div>
      </div>
    );
  };

  const renderCurrentView = () => {
    switch (captureState) {
      case 'capturing':
        return renderCaptureView();
      case 'cropping':
        return renderCroppingView();
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