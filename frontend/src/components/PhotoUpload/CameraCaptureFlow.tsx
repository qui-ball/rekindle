/**
 * CameraCaptureFlow Component
 * 
 * Manages the complete camera capture flow including:
 * 1. Camera capture page
 * 2. Preview page with accept/reject options
 * 3. Future cropping functionality
 * 
 * Features:
 * - Separate page overlay (not full-screen)
 * - Centered camera capture area
 * - Preview state after capture
 * - Accept/reject captured photo
 * - Proper cancel handling
 */

import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CameraCapture } from './CameraCapture';
import { QuadrilateralCropper } from './QuadrilateralCropper';
import { CameraCaptureProps, CropArea, CropAreaPixels } from './types';
import { PhotoDetector } from '../../services/PhotoDetector';

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
  facingMode = 'environment',
  aspectRatio = 4/3
}) => {
  const [captureState, setCaptureState] = useState<CaptureState>('capturing');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [detectedCropArea, setDetectedCropArea] = useState<CropAreaPixels | null>(null);
  const [photoDetector] = useState(() => {
    try {
      return new PhotoDetector();
    } catch (error) {
      console.warn('PhotoDetector initialization failed:', error);
      return null;
    }
  });

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
          
          if (photoDetector) {
            // Try to detect photo boundaries
            const detection = await photoDetector.detectPhotoBoundaries(
              imageData,
              img.naturalWidth,
              img.naturalHeight
            );
            detectedArea = detection.cropArea;
          } else {
            // Fallback to generic crop area when PhotoDetector is not available
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
  }, [photoDetector, onError]);

  // Handle camera errors
  const handleCameraError = useCallback((error: any) => {
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
      {/* Title - positioned absolutely in top center */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
        <h1 className="text-sm font-semibold text-white bg-black bg-opacity-70 px-3 py-1 rounded">
          Take Photo
        </h1>
      </div>
      
      {/* Close button - positioned absolutely in top right */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 flex items-center justify-center text-white"
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
          aspectRatio={aspectRatio}
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