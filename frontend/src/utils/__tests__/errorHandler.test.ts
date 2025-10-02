import { UploadErrorHandler } from '../errorHandler';
import { UploadError, ErrorType } from '../../types/upload';

describe('UploadErrorHandler', () => {
  let errorHandler: UploadErrorHandler;

  beforeEach(() => {
    errorHandler = new UploadErrorHandler();
  });

  describe('handleError', () => {
    it('should handle retryable errors', () => {
      const error: UploadError = {
        name: 'UploadError',
        code: 'UPLOAD_FAILED',
        message: 'Upload failed',
        type: ErrorType.UPLOAD_ERROR,
        retryable: true
      };

      const response = errorHandler.handleError(error);

      expect(response.message).toBe('Upload failed. Please check your connection and try again.');
      expect(response.retryable).toBe(true);
      expect(response.action).toBe('retry');
    });

    it('should handle non-retryable errors', () => {
      const error: UploadError = {
        name: 'UploadError',
        code: 'VALIDATION_FAILED',
        message: 'Invalid file',
        type: ErrorType.VALIDATION_ERROR,
        retryable: false
      };

      const response = errorHandler.handleError(error);

      expect(response.message).toBe('Please check your file and try again.');
      expect(response.retryable).toBe(false);
      expect(response.action).toBe('contact_support');
    });
  });

  describe('getRetryStrategy', () => {
    it('should return no retry strategy for non-retryable errors', () => {
      const error: UploadError = {
        name: 'UploadError',
        code: 'VALIDATION_FAILED',
        message: 'Invalid file',
        type: ErrorType.VALIDATION_ERROR,
        retryable: false
      };

      const strategy = errorHandler.getRetryStrategy(error);

      expect(strategy.maxAttempts).toBe(0);
      expect(strategy.retryableErrors).toEqual([]);
    });

    it('should return network retry strategy for network errors', () => {
      const error: UploadError = {
        name: 'UploadError',
        code: 'NETWORK_ERROR',
        message: 'Network failed',
        type: ErrorType.NETWORK_ERROR,
        retryable: true
      };

      const strategy = errorHandler.getRetryStrategy(error);

      expect(strategy.maxAttempts).toBe(5);
      expect(strategy.retryableErrors).toEqual([ErrorType.NETWORK_ERROR]);
    });

    it('should return upload retry strategy for upload errors', () => {
      const error: UploadError = {
        name: 'UploadError',
        code: 'UPLOAD_FAILED',
        message: 'Upload failed',
        type: ErrorType.UPLOAD_ERROR,
        retryable: true
      };

      const strategy = errorHandler.getRetryStrategy(error);

      expect(strategy.maxAttempts).toBe(3);
      expect(strategy.retryableErrors).toEqual([ErrorType.UPLOAD_ERROR]);
    });
  });

  describe('getUserMessage', () => {
    it('should return specific error code messages', () => {
      const error: UploadError = {
        name: 'UploadError',
        code: 'file_too_large',
        message: 'File too large',
        type: ErrorType.VALIDATION_ERROR,
        retryable: false
      };

      const message = errorHandler.getUserMessage(error);
      expect(message).toBe('This photo is too large. Please try a smaller image or use our mobile camera for best results.');
    });

    it('should return type-based messages for unknown codes', () => {
      const error: UploadError = {
        name: 'UploadError',
        code: 'UNKNOWN_ERROR',
        message: 'Unknown error',
        type: ErrorType.VALIDATION_ERROR,
        retryable: false
      };

      const message = errorHandler.getUserMessage(error);
      expect(message).toBe('Please check your file and try again.');
    });

    it('should return type-based messages when no code provided', () => {
      const error: UploadError = {
        name: 'UploadError',
        message: 'Network error',
        type: ErrorType.NETWORK_ERROR,
        retryable: true
      };

      const message = errorHandler.getUserMessage(error);
      expect(message).toBe('Network error. Please check your connection and try again.');
    });

    it('should handle all error types', () => {
      const errorTypes = [
        ErrorType.VALIDATION_ERROR,
        ErrorType.UPLOAD_ERROR,
        ErrorType.PROCESSING_ERROR,
        ErrorType.NETWORK_ERROR,
        ErrorType.PERMISSION_ERROR,
        ErrorType.STORAGE_ERROR
      ];

      errorTypes.forEach(type => {
        const error: UploadError = {
          name: 'UploadError',
          message: 'Test error',
          type,
          retryable: true
        };

        const message = errorHandler.getUserMessage(error);
        expect(message).toBeTruthy();
        expect(typeof message).toBe('string');
      });
    });
  });
});
