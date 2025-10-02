// Tests for app initialization service
import { appInitialization, AppInitializationService } from '../appInitialization';

// Mock the opencvLoader
jest.mock('../opencvLoader', () => ({
  opencvLoader: {
    loadOpenCV: jest.fn(),
    isReady: jest.fn()
  }
}));

// Import the mocked module
import { opencvLoader } from '../opencvLoader';

describe('AppInitializationService', () => {
  let service: AppInitializationService;
  const mockOpenCVLoader = opencvLoader as jest.Mocked<typeof opencvLoader>;

  beforeEach(() => {
    service = new AppInitializationService();
    jest.clearAllMocks();
  });

  it('should initialize successfully when OpenCV loads', async () => {
    const mockCallback = jest.fn();
    
    // Mock successful OpenCV loading
    mockOpenCVLoader.loadOpenCV.mockImplementation((callback?: (status: { status: string; progress?: number }) => void) => {
      // Simulate loading progress
      setTimeout(() => callback?.({ status: 'loading', progress: 50 }), 10);
      setTimeout(() => callback?.({ status: 'ready' }), 20);
      return Promise.resolve();
    });
    mockOpenCVLoader.isReady.mockReturnValue(true);

    await service.initialize(mockCallback);

    expect(service.isReady()).toBe(true);
    expect(service.getStatus()).toBe('ready');
    expect(service.hasSmartDetection()).toBe(true);
    expect(mockCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ready',
        progress: 100,
        message: 'Smart photo detection ready!'
      })
    );
  });

  it('should fallback gracefully when OpenCV fails to load', async () => {
    const mockCallback = jest.fn();
    
    // Mock OpenCV loading failure
    mockOpenCVLoader.loadOpenCV.mockImplementation((callback?: (status: { status: string; progress?: number }) => void) => {
      setTimeout(() => callback?.({ status: 'error', error: 'Failed to load' }), 10);
      return Promise.reject(new Error('Failed to load'));
    });
    mockOpenCVLoader.isReady.mockReturnValue(false);

    await service.initialize(mockCallback);

    expect(service.isReady()).toBe(true);
    expect(service.getStatus()).toBe('fallback');
    expect(service.hasSmartDetection()).toBe(false);
    expect(mockCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'fallback',
        progress: 100,
        message: 'App ready with basic cropping'
      })
    );
  });

  it('should handle timeout gracefully', async () => {
    const mockCallback = jest.fn();
    
    // Mock OpenCV loading that never completes
    mockOpenCVLoader.loadOpenCV.mockImplementation((callback?: (status: { status: string; progress?: number }) => void) => {
      setTimeout(() => callback?.({ status: 'loading', progress: 50 }), 10);
      // Never calls ready or error
      return new Promise(() => {}); // Never resolves
    });
    mockOpenCVLoader.isReady.mockReturnValue(false);

    // Use fake timers to control timeout
    jest.useFakeTimers();
    
    const initPromise = service.initialize(mockCallback);
    
    // Fast-forward past the 15 second timeout
    jest.advanceTimersByTime(16000);
    
    await initPromise;

    expect(service.isReady()).toBe(true);
    expect(service.getStatus()).toBe('fallback');
    expect(service.hasSmartDetection()).toBe(false);
    
    jest.useRealTimers();
  }, 10000);

  it('should return immediately if already initialized', async () => {
    const mockCallback = jest.fn();
    
    // First initialization
    mockOpenCVLoader.loadOpenCV.mockImplementation((callback: (status: { status: string; progress?: number }) => void) => {
      setTimeout(() => callback({ status: 'ready' }), 10);
      return Promise.resolve();
    });
    mockOpenCVLoader.isReady.mockReturnValue(true);

    await service.initialize();
    
    // Second initialization should return immediately
    await service.initialize(mockCallback);

    expect(mockCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ready',
        progress: 100,
        message: 'App ready'
      })
    );
  });
});

describe('appInitialization singleton', () => {
  it('should export a singleton instance', () => {
    expect(appInitialization).toBeInstanceOf(AppInitializationService);
  });
});