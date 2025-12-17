/**
 * DragDropZone Component
 * 
 * Desktop file upload interface with drag-and-drop support
 * 
 * Features:
 * - Large, intuitive drop area with visual feedback
 * - File browser fallback for traditional selection
 * - Visual feedback for drag-over states
 * - File validation with clear error messaging
 * - Progress indicators with thumbnails (future)
 * - Clear error messaging and retry options
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

'use client';

import React, { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import { DragDropZoneProps, UploadError, ErrorType } from '../../types/upload';
import { validateFile } from '../../utils/fileUtils';

export const DragDropZone: React.FC<DragDropZoneProps> = ({
  onFileSelect,
  onError,
  accept = 'image/jpeg,image/png,image/heic,image/webp',
  maxSize = 50 * 1024 * 1024, // 50MB default
  disabled = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle drag enter event
   */
  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Only allow drag if files are present
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
      setIsDragOver(true);
    }
  }, [disabled]);

  /**
   * Handle drag over event - must prevent default to allow drop
   */
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, [disabled]);

  /**
   * Handle drag leave event
   */
  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Only set to false if we're leaving the drop zone itself
    // (not just moving between child elements)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false);
      setIsDragOver(false);
    }
  }, [disabled]);

  /**
   * Process dropped files
   */
  const processFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    // For MVP, only process the first file
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
      return;
    }

    // File is valid, pass to parent
    onFileSelect(file);
  }, [onFileSelect, onError, maxSize, accept]);

  /**
   * Handle drop event
   */
  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(false);
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    processFiles(files);
  }, [disabled, processFiles]);

  /**
   * Handle file input change (browser fallback)
   */
  const handleFileInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    const files = e.target.files;
    processFiles(files);
    
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [disabled, processFiles]);

  /**
   * Open file browser dialog
   */
  const handleClick = useCallback(() => {
    if (disabled) return;
    
    fileInputRef.current?.click();
  }, [disabled]);

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-lg p-12 text-center
        transition-all duration-200 cursor-pointer
        ${disabled 
          ? 'border-gray-300 bg-gray-50 cursor-not-allowed opacity-50' 
          : isDragOver
            ? 'border-blue-500 bg-blue-50 scale-105 shadow-lg'
            : isDragging
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
        }
      `}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Drag and drop zone for photo upload"
      aria-disabled={disabled}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Hidden file input for browser fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileInputChange}
        className="hidden"
        aria-label="File input"
        disabled={disabled}
        multiple={false}
      />

      {/* Visual content */}
      <div className="flex flex-col items-center justify-center space-y-4">
        {/* Icon */}
        <div className={`
          text-6xl transition-transform duration-200
          ${isDragOver ? 'scale-110' : ''}
        `}>
          {isDragOver ? '📤' : '📁'}
        </div>

        {/* Text content */}
        <div className="space-y-2">
          <h3 className={`
            text-xl font-semibold
            ${isDragOver ? 'text-blue-600' : 'text-gray-700'}
          `}>
            {isDragOver 
              ? 'Drop your photo here' 
              : disabled 
                ? 'Upload disabled'
                : 'Drag & drop your photo here'
            }
          </h3>
          
          <p className="text-gray-500 text-sm">
            or{' '}
            <span className={`
              font-medium underline
              ${disabled ? 'text-gray-400' : 'text-blue-600 hover:text-blue-700'}
            `}>
              browse files
            </span>
          </p>
        </div>

        {/* File requirements */}
        <div className="text-xs text-gray-400 space-y-1 mt-4">
          <p>Supported formats: JPEG, PNG, HEIC, WebP</p>
          <p>Maximum size: {Math.round(maxSize / 1024 / 1024)}MB</p>
        </div>
      </div>

      {/* Drag overlay indicator */}
      {isDragOver && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-10 rounded-lg pointer-events-none" />
      )}
    </div>
  );
};
