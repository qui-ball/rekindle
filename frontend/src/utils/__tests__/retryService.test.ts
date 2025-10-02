import { RetryService, retryStrategies } from '../retryService';
import { UploadError, ErrorType } from '../../types/upload';

describe('RetryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const onRetry = jest.fn();

      const result = await RetryService.executeWithRetry(
        operation,
        retryStrategies.upload,
        onRetry
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(onRetry).not.toHaveBeenCalled();
    }, 10000);

    it('should retry on failure and eventually succeed', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValue('success');
      
      const onRetry = jest.fn();

      const result = await RetryService.executeWithRetry(
        operation,
        retryStrategies.upload,
        onRetry
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
      expect(onRetry).toHaveBeenCalledTimes(2);
    }, 10000);

    it('should throw error after max attempts', async () => {
      const error = new Error('Persistent failure');
      const operation = jest.fn().mockRejectedValue(error);
      const onRetry = jest.fn();

      await expect(
        RetryService.executeWithRetry(
          operation,
          retryStrategies.upload,
          onRetry
        )
      ).rejects.toThrow('Persistent failure');

      expect(operation).toHaveBeenCalledTimes(3); // maxAttempts
      expect(onRetry).toHaveBeenCalledTimes(2); // maxAttempts - 1
    }, 10000);

    it('should not retry non-retryable errors', async () => {
      const error: UploadError = {
        name: 'UploadError',
        code: 'VALIDATION_FAILED',
        message: 'Invalid file',
        type: ErrorType.VALIDATION_ERROR,
        retryable: false
      };

      const operation = jest.fn().mockRejectedValue(error);
      const onRetry = jest.fn();

      try {
        await RetryService.executeWithRetry(
          operation,
          retryStrategies.upload,
          onRetry
        );
        fail('Expected function to throw');
      } catch (thrownError) {
        expect(thrownError).toBe(error);
        expect(operation).toHaveBeenCalledTimes(1);
        expect(onRetry).not.toHaveBeenCalled();
      }
    }, 10000);
  });

  describe('createRetryWrapper', () => {
    it('should create a retry wrapper function', () => {
      const operation = jest.fn().mockResolvedValue('success');
      const wrapper = RetryService.createRetryWrapper(
        operation,
        retryStrategies.upload
      );

      expect(typeof wrapper).toBe('function');
    });

    it('should execute wrapped function with retry logic', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValue('success');
      
      const wrapper = RetryService.createRetryWrapper(
        operation,
        retryStrategies.upload
      );

      const result = await wrapper();
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    }, 10000);
  });
});

describe('retryStrategies', () => {
  it('should have correct network strategy', () => {
    expect(retryStrategies.network.maxAttempts).toBe(3);
    expect(retryStrategies.network.retryableErrors).toEqual([ErrorType.NETWORK_ERROR]);
  });

  it('should have correct upload strategy', () => {
    expect(retryStrategies.upload.maxAttempts).toBe(3);
    expect(retryStrategies.upload.retryableErrors).toEqual([
      ErrorType.UPLOAD_ERROR,
      ErrorType.NETWORK_ERROR
    ]);
  });

  it('should have correct critical strategy', () => {
    expect(retryStrategies.critical.maxAttempts).toBe(5);
    expect(retryStrategies.critical.retryableErrors).toEqual([
      ErrorType.UPLOAD_ERROR,
      ErrorType.NETWORK_ERROR,
      ErrorType.PROCESSING_ERROR
    ]);
  });

  it('should have correct none strategy', () => {
    expect(retryStrategies.none.maxAttempts).toBe(0);
    expect(retryStrategies.none.retryableErrors).toEqual([]);
  });
});
