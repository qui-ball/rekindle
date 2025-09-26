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
import { CameraCaptureProps } from './types';

type CaptureState = 'capturing' | 'preview';

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

  // Handle escape key
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (closeOnEscape && event.key === 'Escape') {
      handleClose();
    }
  }, [closeOnEscape]);

  // Handle close - reset state and close modal
  const handleClose = useCallback(() => {
    setCaptureState('capturing');
    setCapturedImage(null);
    onClose();
  }, [onClose]);

  // Handle camera capture - move to preview state
  const handleCameraCapture = useCallback((imageData: string) => {
    setCapturedImage(imageData);
    setCaptureState('preview');
  }, []);

  // Handle camera errors
  const handleCameraError = useCallback((error: any) => {
    if (error.code === 'USER_CANCELLED') {
      handleClose(); // Close modal on user cancellation
    } else {
      onError(error); // Pass other errors to parent
    }
  }, [onError, handleClose]);

  // Handle accept captured photo
  const handleAccept = useCallback(() => {
    if (capturedImage) {
      onCapture(capturedImage);
      handleClose();
    }
  }, [capturedImage, onCapture, handleClose]);

  // Handle reject captured photo - go back to capturing
  const handleReject = useCallback(() => {
    setCapturedImage(null);
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

  const renderPreviewView = () => (
    <div className="h-screen w-screen bg-gray-900 relative">
      {/* Title - positioned absolutely in top center */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
        <h1 className="text-sm font-semibold text-white bg-black bg-opacity-70 px-3 py-1 rounded">
          Review Photo
        </h1>
      </div>
      
      {/* Close button - positioned absolutely in top right */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 flex items-center justify-center text-white"
        aria-label="Close preview"
      >
        ✕
      </button>

      {/* Preview Container - fills the screen with padding for controls */}
      <div className="h-full w-full flex items-center justify-center pb-24 pt-16">
        {capturedImage && (
          <img
            src={capturedImage}
            alt="Captured preview"
            className="max-w-full max-h-full object-contain"
          />
        )}
      </div>

      {/* Controls - Always at bottom for simplicity */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex flex-row space-x-8 z-10">
        {/* Reject button */}
        <button
          onClick={handleReject}
          className="w-16 h-16 rounded-full border-4 border-red-400 bg-red-500 hover:bg-red-600 active:scale-95 text-white text-2xl transition-all duration-200 shadow-lg"
          aria-label="Reject photo"
        >
          ✕
        </button>
        
        {/* Accept button */}
        <button
          onClick={handleAccept}
          className="w-16 h-16 rounded-full border-4 border-green-400 bg-green-500 hover:bg-green-600 active:scale-95 text-white text-2xl transition-all duration-200 shadow-lg"
          aria-label="Accept photo"
        >
          ✓
        </button>
      </div>
    </div>
  );

  const modalContent = (
    <div className="fixed inset-0 z-50 bg-gray-900 camera-fullscreen">
      {captureState === 'capturing' ? renderCaptureView() : renderPreviewView()}
    </div>
  );

  // Render in portal to ensure proper z-index layering
  return createPortal(modalContent, document.body);
};

export default CameraCaptureFlow;