/**
 * FileUploadFlow Component
 * 
 * Orchestrates the file upload flow:
 * 1. File selection (drag-drop or browse)
 * 2. Preview the selected file
 * 3. Upload confirmation
 * 
 * Features:
 * - Desktop: DragDropZone with drag-and-drop support
 * - Mobile: Native file picker with gallery access
 * - Simple preview before upload (no cropping needed - user already selected the file)
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { FileUploadModal } from './FileUploadModal';
import { UploadPreview } from './UploadPreview';
import { UploadError, ErrorType } from '../../types/upload';
import { fileToDataUrl, getImageDimensionsFromBase64 } from '../../utils/fileUtils';

/** Flow states for file upload */
type FlowState = 'selecting' | 'preview';

interface FileUploadFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (imageData: string) => void;
  onError: (error: UploadError) => void;
  closeOnEscape?: boolean;
  accept?: string;
  maxSize?: number;
}


export const FileUploadFlow: React.FC<FileUploadFlowProps> = ({
  isOpen,
  onClose,
  onUpload,
  onError,
  closeOnEscape = true,
  accept = 'image/jpeg,image/png,image/heic,image/webp',
  maxSize = 50 * 1024 * 1024 // 50MB
}) => {
  // Flow state
  const [flowState, setFlowState] = useState<FlowState>('selecting');
  const [mounted, setMounted] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  /**
   * Reset flow state
   */
  const resetFlow = useCallback(() => {
    setFlowState('selecting');
    setPreviewImage(null);
  }, []);

  /**
   * Handle modal close
   */
  const handleClose = useCallback(() => {
    resetFlow();
    onClose();
  }, [resetFlow, onClose]);

  // Handle portal mounting
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Reset flow state when modal is closed
  useEffect(() => {
    if (!isOpen) {
      resetFlow();
    }
  }, [isOpen, resetFlow]);

  // Handle escape key
  useEffect(() => {
    if (!closeOnEscape || !isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeOnEscape, isOpen, handleClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  /**
   * Handle file selection from FileUploadModal
   * For file uploads, we skip cropping and go directly to preview
   */
  const handleFileSelect = useCallback(async (file: File) => {
    console.log('📁 File selected:', file.name, file.type, `${(file.size / 1024 / 1024).toFixed(2)}MB`);

    try {
      // Convert file to base64 data URL
      const dataUrl = await fileToDataUrl(file);

      // Get image dimensions for logging (optional metadata)
      try {
        const dimensions = await getImageDimensionsFromBase64(dataUrl);
        console.log('📐 Image dimensions:', dimensions);
      } catch (dimError) {
        // Non-critical - continue even if dimension extraction fails
        console.warn('Could not extract image dimensions:', dimError);
      }

      // Set the image data for preview (no cropping, no perspective correction)
      setPreviewImage(dataUrl);
      setFlowState('preview');
    } catch (error) {
      console.error('❌ File processing error:', error);
      const uploadError: UploadError = {
        name: 'ProcessingError',
        message: error instanceof Error ? error.message : 'Failed to process file',
        code: 'FILE_PROCESSING_FAILED',
        type: ErrorType.PROCESSING_ERROR,
        retryable: true
      };
      onError(uploadError);
      resetFlow();
    }
  }, [onError, resetFlow]);

  /**
   * Handle file selection error
   */
  const handleFileError = useCallback((error: UploadError) => {
    onError(error);
  }, [onError]);


  /**
   * Handle upload preview confirmation
   * Note: We do NOT close the flow here - let PhotoUploadContainer handle
   * the upload completion and close the flow when appropriate
   */
  const handlePreviewConfirm = useCallback((imageData: string) => {
    console.log('✅ Upload preview confirmed - submitting image');
    onUpload(imageData);
    // NOTE: Don't call handleClose() here - PhotoUploadContainer will close
    // the flow after upload completes by setting showFileUpload = false
  }, [onUpload]);

  /**
   * Handle upload preview cancellation (go back to file selection)
   */
  const handlePreviewCancel = useCallback(() => {
    console.log('🔄 Preview cancelled - returning to file selection');
    resetFlow();
  }, [resetFlow]);


  // Don't render if not open or not mounted
  if (!isOpen || !mounted) return null;

  // File selection state - show FileUploadModal
  if (flowState === 'selecting') {
    return (
      <FileUploadModal
        isOpen={true}
        onClose={handleClose}
        onFileSelect={handleFileSelect}
        onError={handleFileError}
        accept={accept}
        maxSize={maxSize}
      />
    );
  }

  // Preview state - show UploadPreview (no cropping, no perspective correction for file uploads)
  if (flowState === 'preview' && previewImage) {
    return (
      <UploadPreview
        originalImage={previewImage}
        cornerPoints={undefined} // No corner points = no perspective correction
        onConfirm={handlePreviewConfirm}
        onCancel={handlePreviewCancel}
        closeOnEscape={closeOnEscape}
      />
    );
  }

  // Fallback - shouldn't reach here
  return null;
};
