// Tests for useAppInitialization hook
import { renderHook, waitFor } from '@testing-library/react';
import { useAppInitialization } from '../useAppInitialization';

// Mock the app initialization service
jest.mock('../../services/appInitialization', () => ({
  appInitialization: {
    isReady: jest.fn(),
    getStatus: jest.fn(),
    hasSmartDetection: jest.fn(),
    initialize: jest.fn()
  }
}));

// Import the mocked module
import { appInitialization } from '../../services/appInitialization';

describe('useAppInitialization', () => {
  const mockAppInitialization = appInitialization as jest.Mocked<typeof appInitialization>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return ready state when already initialized', async () => {
    mockAppInitialization.isReady.mockReturnValue(true);
    mockAppInitialization.getStatus.mockReturnValue('ready');
    mockAppInitialization.hasSmartDetection.mockReturnValue(true);

    const { result } = renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
      expect(result.current.progress).toBe(100);
      expect(result.current.isReady).toBe(true);
      expect(result.current.hasSmartDetection).toBe(true);
      expect(result.current.message).toBe('Smart photo detection ready!');
    });
  });

  it('should initialize when not ready', async () => {
    mockAppInitialization.isReady.mockReturnValue(false);
    mockAppInitialization.initialize.mockImplementation((callback?: (state: { status: string; progress: number; message: string }) => void) => {
      // Simulate initialization progress
      setTimeout(() => callback?.({
        status: 'loading',
        progress: 50,
        message: 'Loading...'
      }), 10);
      setTimeout(() => callback?.({
        status: 'ready',
        progress: 100,
        message: 'Ready!'
      }), 20);
      return Promise.resolve();
    });

    const { result } = renderHook(() => useAppInitialization());

    // App is always ready now - OpenCV loads in background
    expect(result.current.status).toBe('loading');
    expect(result.current.isReady).toBe(true);

    // Wait for initialization to complete
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
      expect(result.current.progress).toBe(100);
      expect(result.current.isReady).toBe(true);
    });
  });

  it('should handle initialization failure gracefully', async () => {
    mockAppInitialization.isReady.mockReturnValue(false);
    mockAppInitialization.initialize.mockRejectedValue(new Error('Init failed'));

    const { result } = renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(result.current.status).toBe('fallback');
      expect(result.current.progress).toBe(100);
      expect(result.current.isReady).toBe(true);
      expect(result.current.error).toBe('Init failed');
    });
  });

  it('should provide reinitialize function', async () => {
    mockAppInitialization.isReady.mockReturnValue(true);
    mockAppInitialization.getStatus.mockReturnValue('ready');
    mockAppInitialization.hasSmartDetection.mockReturnValue(true);
    mockAppInitialization.initialize.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    // Call reinitialize
    result.current.reinitialize();

    expect(mockAppInitialization.initialize).toHaveBeenCalled();
  });
});