import { useState, useCallback, useMemo } from 'react';
import { UploadState, UploadResult, UploadError, UploadOptions, ErrorType } from '../types/upload';
import { Result } from '../types';
import { S3UploadService } from '../services/uploadService';
import { UploadErrorHandler } from '../utils/errorHandler';
import { RetryService, retryStrategies } from '../utils/retryService';

/**
 * Custom hook for managing photo upload state and operations
 * Provides upload functionality with progress tracking and error handling
 */
export const usePhotoUpload = () => {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    currentStep: 'method_selection'
  });

  // Initialize services
  const uploadService = useMemo(() => new S3UploadService(), []);
  const errorHandler = useMemo(() => new UploadErrorHandler(), []);

  const uploadPhoto = useCallback(async (
    file: File, 
    options?: UploadOptions
  ): Promise<Result<UploadResult>> => {
    setUploadState(prev => ({
      ...prev,
      status: 'uploading',
      progress: 0,
      selectedFile: file
    }));

    try {
      // Create upload options with progress tracking
      const uploadOptions: UploadOptions = {
        ...options,
        onProgress: (progress) => {
          setUploadState(prev => ({ ...prev, progress }));
          options?.onProgress?.(progress);
        },
        onError: (error) => {
          setUploadState(prev => ({ ...prev, status: 'error', error }));
          options?.onError?.(error);
        }
      };

      // Execute upload with retry logic
      const result = await RetryService.executeWithRetry(
        () => uploadService.uploadFile(file, uploadOptions),
        retryStrategies.upload,
        (attempt, error) => {
          console.log(`Upload retry attempt ${attempt}:`, error.message);
          setUploadState(prev => ({
            ...prev,
            status: 'uploading',
            progress: Math.max(0, prev.progress - 10) // Slight progress rollback on retry
          }));
        }
      );

      setUploadState(prev => ({
        ...prev,
        status: 'complete',
        progress: 100,
        uploadResult: result
      }));

      return { success: true, data: result };
    } catch (error) {
      const uploadError = error as UploadError;
      
      // Handle error with proper error handling
      const errorResponse = errorHandler.handleError(uploadError);
      
      setUploadState(prev => ({
        ...prev,
        status: 'error',
        error: uploadError
      }));

      options?.onError?.(uploadError);
      return { success: false, error: uploadError };
    }
  }, []);

  const resetUpload = useCallback(() => {
    setUploadState({
      status: 'idle',
      progress: 0,
      currentStep: 'method_selection'
    });
  }, []);

  const retryUpload = useCallback(async (): Promise<Result<UploadResult>> => {
    if (!uploadState.selectedFile) {
      return { 
        success: false, 
        error: new Error('No file selected for retry') as UploadError 
      };
    }

    return uploadPhoto(uploadState.selectedFile);
  }, [uploadState.selectedFile, uploadPhoto]);

  const cancelUpload = useCallback(async () => {
    // TODO: Implement upload cancellation
    // This would require tracking active uploads and calling uploadService.cancelUpload()
    setUploadState(prev => ({
      ...prev,
      status: 'idle',
      progress: 0
    }));
  }, []);

  const getErrorMessage = useCallback((error?: UploadError): string => {
    if (!error) return '';
    return errorHandler.getUserMessage(error);
  }, [errorHandler]);

  const canRetry = useCallback((error?: UploadError): boolean => {
    if (!error) return false;
    const strategy = errorHandler.getRetryStrategy(error);
    return strategy && strategy.maxAttempts > 0;
  }, [errorHandler]);

  return {
    uploadState,
    uploadPhoto,
    resetUpload,
    retryUpload,
    cancelUpload,
    getErrorMessage,
    canRetry
  };
};