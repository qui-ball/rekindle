import { UploadError, ErrorType, RetryStrategy } from '../types/upload';

/**
 * Error handling utilities for upload system
 * Provides user-friendly error messages and retry strategies
 */
export interface ErrorHandler {
  handleError(error: UploadError): ErrorResponse;
  getRetryStrategy(error: UploadError): RetryStrategy;
  getUserMessage(error: UploadError): string;
}

export interface ErrorResponse {
  message: string;
  retryable: boolean;
  action?: string;
}

/**
 * Default retry strategy configuration
 */
export const defaultRetryStrategy: RetryStrategy = {
  maxAttempts: 3,
  backoffMultiplier: 2,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  retryableErrors: [ErrorType.NETWORK_ERROR, ErrorType.UPLOAD_ERROR]
};

/**
 * Implementation of ErrorHandler
 * Provides comprehensive error handling for upload flows
 */
export class UploadErrorHandler implements ErrorHandler {
  handleError(_error: UploadError): ErrorResponse {
    // Implementation will be added in task 11.1
    throw new Error('Not implemented yet');
  }

  getRetryStrategy(_error: UploadError): RetryStrategy {
    // Implementation will be added in task 7.2
    throw new Error('Not implemented yet');
  }

  getUserMessage(error: UploadError): string {
    // Implementation will be added in task 11.1
    return this.getDefaultMessage(error.code);
  }

  private getDefaultMessage(errorCode: string): string {
    const messages: Record<string, string> = {
      'file_too_large': 'This photo is too large. Please try a smaller image or use our mobile camera for best results.',
      'unsupported_format': 'This file type isn\'t supported. Please use JPG, PNG, or HEIC photos.',
      'camera_permission_denied': 'We need camera access to take photos. Please allow camera permission and try again.',
      'network_error': 'Upload failed due to connection issues. Please check your internet and try again.',
      'storage_full': 'Unable to upload right now. Please try again in a few minutes.'
    };
    
    return messages[errorCode] || 'An unexpected error occurred. Please try again.';
  }
}