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
  handleError(error: UploadError): ErrorResponse {
    const message = this.getUserMessage(error);
    const retryable = this.isRetryable(error);
    
    return {
      message,
      retryable,
      action: retryable ? 'retry' : 'contact_support'
    };
  }

  getRetryStrategy(error: UploadError): RetryStrategy {
    if (!this.isRetryable(error)) {
      return {
        maxAttempts: 0,
        backoffMultiplier: 1,
        initialDelay: 0,
        maxDelay: 0,
        retryableErrors: []
      };
    }

    // Customize retry strategy based on error type
    switch (error.type) {
      case ErrorType.NETWORK_ERROR:
        return {
          maxAttempts: 5,
          backoffMultiplier: 2,
          initialDelay: 1000,
          maxDelay: 30000,
          retryableErrors: [ErrorType.NETWORK_ERROR]
        };
      case ErrorType.UPLOAD_ERROR:
        return {
          maxAttempts: 3,
          backoffMultiplier: 2,
          initialDelay: 2000,
          maxDelay: 10000,
          retryableErrors: [ErrorType.UPLOAD_ERROR]
        };
      default:
        return defaultRetryStrategy;
    }
  }

  getUserMessage(error: UploadError): string {
    // Check for specific error codes first
    if (error.code) {
      const specificMessage = this.getDefaultMessage(error.code);
      if (specificMessage !== 'An unexpected error occurred. Please try again.') {
        return specificMessage;
      }
    }
    
    // Fallback to type-based messages
    switch (error.type) {
      case ErrorType.VALIDATION_ERROR:
        return 'Please check your file and try again.';
      case ErrorType.UPLOAD_ERROR:
        return 'Upload failed. Please check your connection and try again.';
      case ErrorType.PROCESSING_ERROR:
        return 'Processing failed. Please try again.';
      case ErrorType.NETWORK_ERROR:
        return 'Network error. Please check your connection and try again.';
      case ErrorType.PERMISSION_ERROR:
        return 'Permission denied. Please check your settings and try again.';
      case ErrorType.STORAGE_ERROR:
        return 'Storage error. Please try again later.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  private isRetryable(error: UploadError): boolean {
    return error.retryable && defaultRetryStrategy.retryableErrors.includes(error.type);
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