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
 * - Loading state during file processing
 * - Keyboard accessibility
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

'use client';

import React, { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import { DragDropZoneProps, UploadError, ErrorType } from '../../types/upload';
import { validateFile } from '../../utils/fileUtils';

/** Drag state enum for consolidated state management */
type DragState = 'idle' | 'dragging' | 'dragover';

/** Processing state for loading indicator */
type ProcessingState = 'idle' | 'processing';

/** Style configuration for different component states */
const styles = {
  base: 'relative border-2 border-dashed border-cozy-borderCard rounded-cozy-lg bg-cozy-surface p-12 text-center transition-all duration-200 cursor-pointer',
  states: {
    disabled: 'border-cozy-borderCard bg-cozy-mount cursor-not-allowed opacity-50',
    dragover: 'border-cozy-accent bg-cozy-mount motion-safe:scale-105 motion-reduce:scale-100 shadow-cozy-card',
    dragging: 'border-cozy-accent bg-cozy-mount',
    idle: 'border-cozy-borderCard bg-cozy-surface hover:border-cozy-accent hover:bg-cozy-mount'
  },
  icon: {
    base: 'text-6xl transition-transform duration-200 motion-reduce:transition-none',
    scaled: 'motion-safe:scale-110 motion-reduce:scale-100'
  },
  title: {
    active: 'text-cozy-accent',
    default: 'text-cozy-text'
  }
} as const;

/**
 * Get the appropriate style class based on current state
 */
const getStateStyle = (dragState: DragState, disabled: boolean): string => {
  if (disabled) return styles.states.disabled;
  if (dragState === 'dragover') return styles.states.dragover;
  if (dragState === 'dragging') return styles.states.dragging;
  return styles.states.idle;
};

export const DragDropZone: React.FC<DragDropZoneProps> = ({
  onFileSelect,
  onError,
  accept = 'image/jpeg,image/png,image/heic,image/webp',
  maxSize = 50 * 1024 * 1024, // 50MB default
  disabled = false
}) => {
  // Consolidated drag state
  const [dragState, setDragState] = useState<DragState>('idle');
  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
  
  // Counter-based drag tracking for reliable drag leave detection
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle drag enter event - increment counter for reliable tracking
   */
  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Only track if files are present
    if (e.dataTransfer.types.includes('Files')) {
      dragCounterRef.current++;
      
      // Set dragging on first enter
      if (dragCounterRef.current === 1) {
        setDragState('dragging');
      }
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
      setDragState('dragover');
    }
  }, [disabled]);

  /**
   * Handle drag leave event - decrement counter for reliable tracking
   */
  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    dragCounterRef.current--;
    
    // Reset state only when all drag events have left
    if (dragCounterRef.current === 0) {
      setDragState('idle');
    }
  }, [disabled]);

  /**
   * Process dropped files
   */
  const processFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    // Show processing state
    setProcessingState('processing');

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
      setProcessingState('idle');
      onError(error);
      return;
    }

    // File is valid, pass to parent
    // Note: Processing state will be reset by parent component after handling
    onFileSelect(file);
    setProcessingState('idle');
  }, [onFileSelect, onError, maxSize, accept]);

  /**
   * Handle drop event - reset counter and process files
   */
  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Reset drag counter and state
    dragCounterRef.current = 0;
    setDragState('idle');
    
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
    if (disabled || processingState === 'processing') return;
    
    fileInputRef.current?.click();
  }, [disabled, processingState]);

  /**
   * Handle keyboard interaction
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled || processingState === 'processing') return;
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [disabled, processingState, handleClick]);

  const isActive = dragState === 'dragover';
  const isProcessing = processingState === 'processing';

  return (
    <div
      className={`${styles.base} ${getStateStyle(dragState, disabled || isProcessing)}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Drag and drop zone for photo upload"
      aria-disabled={disabled}
      aria-busy={isProcessing}
      onKeyDown={handleKeyDown}
      data-testid="drag-drop-zone"
      data-drag-state={dragState}
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
        <div className={`${styles.icon.base} ${isActive ? styles.icon.scaled : ''}`}>
          {isProcessing ? '⏳' : isActive ? '📤' : '📁'}
        </div>

        {/* Text content */}
        <div className="space-y-2">
          <h3 className={`text-xl font-semibold ${isActive ? styles.title.active : styles.title.default}`}>
            {isProcessing 
              ? 'Processing...'
              : isActive 
                ? 'Drop your photo here' 
                : disabled 
                  ? 'Upload disabled'
                  : 'Drag & drop your photo here'
            }
          </h3>
          
          {!isProcessing && (
            <p className="text-cozy-textSecondary text-sm">
              or{' '}
              <span className={`font-medium underline ${disabled ? 'text-cozy-textSecondary opacity-70' : 'text-cozy-accent hover:text-cozy-accentDark'}`}>
                browse files
              </span>
            </p>
          )}
        </div>

        {/* File requirements */}
        {!isProcessing && (
          <div className="text-xs text-cozy-textSecondary space-y-1 mt-4">
            <p>Supported formats: JPEG, PNG, HEIC, WebP</p>
            <p>Maximum size: {Math.round(maxSize / 1024 / 1024)}MB</p>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="text-sm text-cozy-textSecondary">
            Validating your photo...
          </div>
        )}
      </div>

      {/* Drag overlay indicator */}
      {isActive && (
        <div 
          className="absolute inset-0 bg-cozy-accent/10 rounded-lg pointer-events-none" 
          aria-hidden="true"
        />
      )}
    </div>
  );
};
