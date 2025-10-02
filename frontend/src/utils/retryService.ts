import { UploadError, RetryStrategy, ErrorType } from '../types/upload';

/**
 * Retry service for handling upload retries with exponential backoff
 * Implements retry logic with configurable strategies
 */
export class RetryService {
  /**
   * Execute a function with retry logic
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    strategy: RetryStrategy,
    onRetry?: (attempt: number, error: UploadError) => void
  ): Promise<T> {
    let lastError: UploadError;
    
    for (let attempt = 1; attempt <= strategy.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as UploadError;
        
        // Check if error is retryable
        if (!this.isRetryableError(lastError, strategy)) {
          throw lastError;
        }
        
        // If this was the last attempt, throw the error
        if (attempt === strategy.maxAttempts) {
          throw lastError;
        }
        
        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, strategy);
        
        // Notify about retry
        onRetry?.(attempt, lastError);
        
        // Wait before next attempt
        await this.delay(delay);
      }
    }
    
    throw lastError!;
  }

  /**
   * Calculate delay for retry with exponential backoff
   */
  private static calculateDelay(attempt: number, strategy: RetryStrategy): number {
    const exponentialDelay = strategy.initialDelay * Math.pow(strategy.backoffMultiplier, attempt - 1);
    return Math.min(exponentialDelay, strategy.maxDelay);
  }

  /**
   * Check if error is retryable based on strategy
   */
  private static isRetryableError(error: unknown, strategy: RetryStrategy): boolean {
    // Check if it's an UploadError with proper structure
    if (error && typeof error === 'object' && 'type' in error && 'retryable' in error) {
      const uploadError = error as { retryable: boolean; type: string };
      return uploadError.retryable && strategy.retryableErrors.includes(uploadError.type as ErrorType);
    }
    
    // For regular errors, assume they're retryable if strategy allows it
    return strategy.retryableErrors.length > 0;
  }

  /**
   * Delay execution for specified milliseconds
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a retry wrapper for upload operations
   */
  static createRetryWrapper<T>(
    operation: () => Promise<T>,
    strategy: RetryStrategy,
    onRetry?: (attempt: number, error: UploadError) => void
  ) {
    return () => this.executeWithRetry(operation, strategy, onRetry);
  }
}

/**
 * Retry strategies for different scenarios
 */
export const retryStrategies = {
  // Quick retry for network issues
  network: {
    maxAttempts: 3,
    backoffMultiplier: 2,
    initialDelay: 1000,
    maxDelay: 5000,
    retryableErrors: [ErrorType.NETWORK_ERROR]
  } as RetryStrategy,

  // Standard retry for upload issues
  upload: {
    maxAttempts: 3,
    backoffMultiplier: 2,
    initialDelay: 2000,
    maxDelay: 10000,
    retryableErrors: [ErrorType.UPLOAD_ERROR, ErrorType.NETWORK_ERROR]
  } as RetryStrategy,

  // Aggressive retry for critical operations
  critical: {
    maxAttempts: 5,
    backoffMultiplier: 1.5,
    initialDelay: 1000,
    maxDelay: 30000,
    retryableErrors: [ErrorType.UPLOAD_ERROR, ErrorType.NETWORK_ERROR, ErrorType.PROCESSING_ERROR]
  } as RetryStrategy,

  // No retry for validation errors
  none: {
    maxAttempts: 0,
    backoffMultiplier: 1,
    initialDelay: 0,
    maxDelay: 0,
    retryableErrors: []
  } as RetryStrategy
};
