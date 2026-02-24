/**
 * FileUploadModal Component
 * 
 * Modal for file upload with adaptive behavior:
 * - Desktop: Shows DragDropZone with drag-and-drop support
 * - Mobile: Shows simplified file picker (native media folder access)
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 2.1, 2.2
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Card, Button } from '@/components/ui';
import { DragDropZone } from './DragDropZone';
import { UploadError, ErrorType } from '../../types/upload';
import { validateFile } from '../../utils/fileUtils';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (file: File) => void;
  onError: (error: UploadError) => void;
  accept?: string;
  maxSize?: number;
}

/**
 * Hook to detect if user is on a mobile device
 * Uses both user agent and screen size for reliable detection
 */
const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      // Check user agent for mobile devices
      const userAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      
      // Also check screen width as fallback
      const screenMobile = window.innerWidth < 768;
      
      // Check for touch capability
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Consider mobile if user agent says so, OR if small screen with touch
      setIsMobile(userAgentMobile || (screenMobile && hasTouch));
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
};

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  onFileSelect,
  onError,
  accept = 'image/jpeg,image/png,image/heic,image/webp',
  maxSize = 50 * 1024 * 1024 // 50MB
}) => {
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  // Handle portal mounting
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Auto-open file picker on mobile when modal opens
  useEffect(() => {
    if (isOpen && isMobile && fileInputRef.current) {
      // Small delay to ensure modal is rendered
      const timer = setTimeout(() => {
        fileInputRef.current?.click();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isMobile]);

  /**
   * Handle file selection from native picker (mobile)
   * Note: Does NOT auto-close - parent controls flow after file selection
   */
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      // User cancelled - close modal on mobile
      if (isMobile) {
        onClose();
      }
      return;
    }

    const file = files[0];
    
    // Parse accept string to array of MIME types
    const allowedTypes = accept
      .split(',')
      .map(type => type.trim())
      .filter(type => type.length > 0);

    // Validate file
    const validation = validateFile(file, maxSize, allowedTypes);
    
    if (!validation.valid) {
      const error: UploadError = {
        name: 'ValidationError',
        message: validation.error || 'File validation failed',
        code: 'VALIDATION_FAILED',
        type: ErrorType.VALIDATION_ERROR,
        retryable: false
      };
      onError(error);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // File is valid - notify parent (parent controls what happens next)
    onFileSelect(file);
    // NOTE: Removed onClose() - parent (FileUploadFlow) controls the flow
    
    // Reset input for next selection
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [accept, maxSize, onFileSelect, onError, isMobile]);

  /**
   * Handle file selection from DragDropZone (desktop)
   * Note: Does NOT auto-close - parent controls flow after file selection
   */
  const handleDragDropFileSelect = useCallback((file: File) => {
    onFileSelect(file);
    // NOTE: Removed onClose() - parent (FileUploadFlow) controls the flow
  }, [onFileSelect]);

  /**
   * Handle click on mobile upload button
   */
  const handleMobileUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-upload-modal-title"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <Card className="relative max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto border border-cozy-borderCard rounded-cozy-lg shadow-cozy-card">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cozy-borderCard">
          <h2 id="file-upload-modal-title" className="text-xl font-semibold text-cozy-heading">
            {isMobile ? 'Select Photo' : 'Upload Photo'}
          </h2>
          <Button
            variant="ghost"
            onClick={onClose}
            className="p-2 rounded-full min-w-0"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5 text-cozy-textSecondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Hidden file input - always present for both mobile and desktop */}
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileInputChange}
            className="hidden"
            aria-label="File input"
            data-testid="file-upload-modal-input"
            // On mobile, allow access to camera roll and files
            capture={undefined}
          />

          {isMobile ? (
            /* Mobile: Simple file picker UI */
            <div className="text-center space-y-6">
              <div className="text-6xl">📷</div>

              <div className="space-y-2">
                <p className="text-cozy-text">
                  Select a photo from your device
                </p>
                <p className="text-sm text-cozy-textSecondary">
                  Supported formats: JPEG, PNG, HEIC, WebP
                </p>
              </div>

              <Button
                onClick={handleMobileUploadClick}
                variant="primary"
                size="large"
                fullWidth
              >
                📁 Choose from Photos
              </Button>

              <p className="text-xs text-cozy-textSecondary">
                Maximum file size: {Math.round(maxSize / 1024 / 1024)}MB
              </p>
            </div>
          ) : (
            /* Desktop: Full drag-and-drop zone */
            <DragDropZone
              onFileSelect={handleDragDropFileSelect}
              onError={onError}
              accept={accept}
              maxSize={maxSize}
            />
          )}
        </div>

        {/* Footer - Cancel button */}
        <div className="flex justify-end p-4 border-t border-cozy-borderCard bg-cozy-surface">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );

  // Render in portal for proper z-index stacking
  return createPortal(modalContent, document.body);
};
