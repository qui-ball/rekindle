import { renderHook, act } from '@testing-library/react';
import { usePhotoUpload } from '../usePhotoUpload';
import { ErrorType } from '../../types/upload';

// Mock the services
jest.mock('../../services/uploadService');
jest.mock('../../utils/errorHandler');
jest.mock('../../utils/retryService');

describe('usePhotoUpload', () => {
  const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with idle state', () => {
    const { result } = renderHook(() => usePhotoUpload());
    
    expect(result.current.uploadState.status).toBe('idle');
    expect(result.current.uploadState.progress).toBe(0);
    expect(result.current.uploadState.currentStep).toBe('method_selection');
  });

  it('should handle successful upload', async () => {
    const { result } = renderHook(() => usePhotoUpload());
    
    const mockResult = {
      uploadId: 'test-123',
      fileKey: 'test-key',
      thumbnailUrl: 'test-url',
      originalFileName: 'test.jpg',
      fileSize: 1024,
      dimensions: { width: 100, height: 100 },
      processingStatus: 'queued' as const
    };

    // Mock successful upload
    const mockUploadService = require('../../services/uploadService').S3UploadService;
    mockUploadService.prototype.uploadFile = jest.fn().mockResolvedValue(mockResult);

    const mockRetryService = require('../../utils/retryService').RetryService;
    mockRetryService.executeWithRetry = jest.fn().mockResolvedValue(mockResult);

    await act(async () => {
      const uploadResult = await result.current.uploadPhoto(mockFile);
      expect(uploadResult.success).toBe(true);
      expect(uploadResult.data).toEqual(mockResult);
    });

    expect(result.current.uploadState.status).toBe('complete');
    expect(result.current.uploadState.progress).toBe(100);
    expect(result.current.uploadState.uploadResult).toEqual(mockResult);
  });

  it('should handle upload errors with retry logic', async () => {
    const { result } = renderHook(() => usePhotoUpload());
    
    const mockError = {
      name: 'UploadError',
      code: 'UPLOAD_FAILED',
      message: 'Upload failed',
      type: ErrorType.UPLOAD_ERROR,
      retryable: true
    };

    // Mock retry service to throw error after retries
    const mockRetryService = require('../../utils/retryService').RetryService;
    mockRetryService.executeWithRetry = jest.fn().mockRejectedValue(mockError);

    await act(async () => {
      const uploadResult = await result.current.uploadPhoto(mockFile);
      expect(uploadResult.success).toBe(false);
      expect(uploadResult.error).toEqual(mockError);
    });

    expect(result.current.uploadState.status).toBe('error');
    expect(result.current.uploadState.error).toEqual(mockError);
  });

  it('should reset upload state', () => {
    const { result } = renderHook(() => usePhotoUpload());
    
    act(() => {
      result.current.resetUpload();
    });

    expect(result.current.uploadState.status).toBe('idle');
    expect(result.current.uploadState.progress).toBe(0);
    expect(result.current.uploadState.currentStep).toBe('method_selection');
  });

  it('should retry upload', async () => {
    const { result } = renderHook(() => usePhotoUpload());
    
    const mockResult = {
      uploadId: 'test-123',
      fileKey: 'test-key',
      thumbnailUrl: 'test-url',
      originalFileName: 'test.jpg',
      fileSize: 1024,
      dimensions: { width: 100, height: 100 },
      processingStatus: 'queued' as const
    };

    // Mock successful retry
    const mockRetryService = require('../../utils/retryService').RetryService;
    mockRetryService.executeWithRetry = jest.fn().mockResolvedValue(mockResult);

    // Set up state with selected file
    act(() => {
      result.current.uploadState.selectedFile = mockFile;
    });

    await act(async () => {
      const retryResult = await result.current.retryUpload();
      expect(retryResult.success).toBe(true);
      expect(retryResult.data).toEqual(mockResult);
    });
  });

  it('should handle retry without selected file', async () => {
    const { result } = renderHook(() => usePhotoUpload());
    
    await act(async () => {
      const retryResult = await result.current.retryUpload();
      expect(retryResult.success).toBe(false);
      expect(retryResult.error?.message).toBe('No file selected for retry');
    });
  });

  it('should cancel upload', () => {
    const { result } = renderHook(() => usePhotoUpload());
    
    act(() => {
      result.current.cancelUpload();
    });

    expect(result.current.uploadState.status).toBe('idle');
    expect(result.current.uploadState.progress).toBe(0);
  });

  it('should get error message', () => {
    const { result } = renderHook(() => usePhotoUpload());
    
    // Test that the function exists
    expect(typeof result.current.getErrorMessage).toBe('function');
    
    // Test with undefined error
    const emptyMessage = result.current.getErrorMessage(undefined);
    expect(emptyMessage).toBe('');
    
    // Test with a simple error
    const simpleError = {
      name: 'UploadError',
      message: 'Test error',
      type: ErrorType.UPLOAD_ERROR,
      retryable: true
    };
    
    const errorMessage = result.current.getErrorMessage(simpleError);
    expect(typeof errorMessage).toBe('string');
  });

  it('should check if error can be retried', () => {
    const { result } = renderHook(() => usePhotoUpload());
    
    const retryableError = {
      name: 'UploadError',
      code: 'UPLOAD_FAILED',
      message: 'Upload failed',
      type: ErrorType.UPLOAD_ERROR,
      retryable: true
    };

    const nonRetryableError = {
      name: 'UploadError',
      code: 'VALIDATION_FAILED',
      message: 'Invalid file',
      type: ErrorType.VALIDATION_ERROR,
      retryable: false
    };

    expect(typeof result.current.canRetry).toBe('function');
    expect(result.current.canRetry(undefined)).toBe(false);
  });
});
