/**
 * CameraCaptureFlow Component
 * 
 * Manages the complete camera capture flow including:
 * 1. Camera capture page
 * 2. Direct transition to cropping interface
 * 3. Quadrilateral cropping with corner handles
 * 
 * Features:
 * - Full-screen camera interface
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

  if (!isOpen) {
    return null;
  }

  const renderCaptureView = () => (
    <div className="h-screen w-screen bg-gray-900 relative">
      {/* Title - positioned safely inside screen bounds */}
      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-10 px-4">
        <h1 className="text-sm font-semibold text-white bg-black bg-opacity-70 px-3 py-1 rounded shadow-lg">
          Take Photo
        </h1>
      </div>
      
      {/* Close button - positioned safely inside screen bounds */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 z-10 w-10 h-10 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 flex items-center justify-center text-white shadow-lg"
        aria-label="Close camera"
      >
        ✕
      </button>

      {/* Camera Component - Full screen with UI overlaid */}
      <div className="absolute inset-0">
        <CameraCapture
          onCapture={handleCameraCapture}
          onError={handleCameraError}
          facingMode={facingMode}
        />
      </div>
    </div>
  );

  const renderCroppingView = () => {
    if (!capturedImage) return null;

    return (
      <QuadrilateralCropper
        image={capturedImage}
        onCropComplete={handleCropComplete}
        onCancel={handleCropCancel}
        initialCropArea={detectedCropArea || undefined}
        isFullScreen={true}
      />
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