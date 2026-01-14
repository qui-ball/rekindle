/**
 * UploadPreview Component
 * 
 * Shows perspective-corrected preview before upload.
 * Allows users to confirm or retake the photo.
 * 
 * Features:
 * - Applies perspective correction using OpenCV.js in <1 second
 * - Shows corrected image preview before upload
 * - Provides "Retake" and "Confirm" buttons
 * - Graceful fallback to original image if correction fails
 * - Works offline (uses already-loaded OpenCV.js)
 * - Displays processing status and time
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import NextImage from 'next/image';
import { perspectiveCorrectionService } from '../../services/perspectiveCorrectionService';
import type { CornerPoints } from '../../types/jscanify';

interface UploadPreviewProps {
  originalImage: string; // Base64 image data
  cornerPoints?: CornerPoints; // Optional JScanify corner points for perspective correction
  onConfirm: (correctedImage: string) => void; // Callback with corrected (or original) image
  onCancel: () => void; // Retake photo
  closeOnEscape?: boolean;
}

type PreviewState = 'processing' | 'ready' | 'error' | 'fallback';

export const UploadPreview: React.FC<UploadPreviewProps> = ({
  originalImage,
  cornerPoints,
  onConfirm,
  onCancel,
  closeOnEscape = true
}) => {
  const [previewState, setPreviewState] = useState<PreviewState>('processing');
  const [correctedImage, setCorrectedImage] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState<number>(0);

  // Apply perspective correction when component mounts (if corner points provided)
  useEffect(() => {
    const applyCorrection = async () => {
      // If no corner points, skip perspective correction and use original image
      if (!cornerPoints) {
        console.log('📷 No corner points provided - showing original image without perspective correction');
        setCorrectedImage(originalImage);
        setPreviewState('ready');
        return;
      }

      setPreviewState('processing');
      
      try {
        // Ensure service is initialized
        if (!perspectiveCorrectionService.isReady()) {
          await perspectiveCorrectionService.initialize();
        }

        // Apply perspective correction
        const result = await perspectiveCorrectionService.correctPerspective(
          originalImage,
          cornerPoints,
          {
            quality: 0.95,
            timeout: 5000
          }
        );

        setProcessingTime(result.processingTime || 0);

        if (result.success && result.correctedImageData) {
          setCorrectedImage(result.correctedImageData);
          setPreviewState('ready');
        } else {
          // Fallback to original image
          console.warn('Perspective correction failed, using original image:', result.error);
          setCorrectedImage(originalImage);
          setPreviewState('fallback');
        }
      } catch (error) {
        // Fallback to original image on error
        console.error('Perspective correction error:', error);
        setCorrectedImage(originalImage);
        setPreviewState('fallback');
      }
    };

    applyCorrection();
  }, [originalImage, cornerPoints]);

  // Handle escape key
  useEffect(() => {
    if (!closeOnEscape) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeOnEscape, onCancel]);

  // Handle confirm button
  const handleConfirm = useCallback(() => {
    if (correctedImage) {
      onConfirm(correctedImage);
    }
  }, [correctedImage, onConfirm]);

  // Render loading state
  const renderProcessing = () => (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mb-4"></div>
      <p className="text-white text-lg font-medium">Processing photo...</p>
      <p className="text-white/70 text-sm mt-2">Applying perspective correction</p>
    </div>
  );

  // Render preview
  const renderPreview = () => (
    <div className="flex flex-col h-full">
      {/* Preview Image */}
      <div className="flex-1 flex items-center justify-center bg-black/50 p-4">
        <div className="relative max-w-full max-h-full">
          <NextImage
            src={correctedImage || originalImage}
            alt="Preview"
            width={800}
            height={600}
            className="object-contain max-w-full max-h-[60vh]"
            unoptimized
          />
        </div>
      </div>

      {/* Status Banner */}
      {previewState === 'fallback' && (
        <div className="bg-yellow-500/90 text-white px-4 py-2 text-center">
          <p className="text-sm font-medium">⚠️ Using original image (correction unavailable)</p>
        </div>
      )}

      {previewState === 'ready' && processingTime > 0 && process.env.NODE_ENV === 'development' && (
        <div className="bg-green-500/90 text-white px-4 py-2 text-center">
          <p className="text-sm font-medium">✅ Perspective corrected ({processingTime.toFixed(0)}ms)</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 p-6 bg-black/80">
        <button
          onClick={onCancel}
          className="flex-1 px-6 py-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
        >
          {cornerPoints ? 'Retake' : 'Cancel'}
        </button>
        <button
          onClick={handleConfirm}
          disabled={!correctedImage}
          className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          Confirm & Upload
        </button>
      </div>
    </div>
  );

  // Main render
  const content = (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="bg-black/90 px-4 py-3 flex items-center justify-between border-b border-white/10">
        <h2 className="text-white text-lg font-semibold">
          {cornerPoints ? 'Preview' : 'Review File'}
        </h2>
        <button
          onClick={onCancel}
          className="text-white/70 hover:text-white transition-colors p-2"
          aria-label="Close preview"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {previewState === 'processing' ? renderProcessing() : renderPreview()}
      </div>
    </div>
  );

  // Use portal to render at document body level
  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};

