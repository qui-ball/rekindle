// Tests for JScanify service integration
import { jscanifyService, JScanifyService } from '../jscanifyService';

// Mock OpenCV loader
jest.mock('../opencvLoader', () => ({
  opencvLoader: {
    isReady: jest.fn(() => false),
    loadOpenCV: jest.fn(() => Promise.resolve()),
    getOpenCV: jest.fn(() => ({
      Mat: jest.fn(),
      imread: jest.fn(),
      delete: jest.fn()
    }))
  }
}));

// Mock JScanify
jest.mock('jscanify', () => {
  return jest.fn().mockImplementation(() => ({
    findPaperContour: jest.fn(),
    getCornerPoints: jest.fn()
  }));
});

describe('JScanifyService', () => {
  let service: JScanifyService;

  beforeEach(() => {
    service = new JScanifyService();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully when OpenCV is available', async () => {
      // Mock OpenCV as available
      const { opencvLoader } = await import('../opencvLoader');
      (opencvLoader.isReady as jest.Mock).mockReturnValue(true);
      
      // Mock window.cv
      Object.defineProperty(window, 'cv', {
        value: { Mat: jest.fn() },
        writable: true
      });

      const result = await service.initialize();
      expect(result).toBe(true);
      expect(service.isInitialized()).toBe(true);
    });

    it('should fail gracefully when OpenCV is not available', async () => {
      const { opencvLoader } = await import('../opencvLoader');
      (opencvLoader.isReady as jest.Mock).mockReturnValue(false);
      (opencvLoader.loadOpenCV as jest.Mock).mockRejectedValue(new Error('OpenCV load failed'));

      const result = await service.initialize();
      expect(result).toBe(false);
      expect(service.isInitialized()).toBe(false);
    });
  });

  describe('detectPhotoBoundaries', () => {
    it('should return fallback crop area when not initialized', async () => {
      const result = await service.detectPhotoBoundaries('data:image/jpeg;base64,test', 800, 600);
      
      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0.5);
      expect(result.cropArea).toEqual({
        x: 80,
        y: 60,
        width: 640,
        height: 480
      });
    });

    it('should handle image loading errors gracefully', async () => {
      // Initialize service
      const { opencvLoader } = await import('../opencvLoader');
      (opencvLoader.isReady as jest.Mock).mockReturnValue(true);
      Object.defineProperty(window, 'cv', {
        value: { Mat: jest.fn() },
        writable: true
      });
      await service.initialize();

      // Mock Image constructor to simulate loading error
      const mockImage = {
        crossOrigin: '',
        onload: null,
        onerror: null,
        src: ''
      };

      const originalImage = global.Image;
      (global as unknown as { Image: unknown }).Image = jest.fn(() => mockImage);

      // Start the detection
      const detectionPromise = service.detectPhotoBoundaries('invalid-image-data', 800, 600);

      // Simulate image loading error
      setTimeout(() => {
        if (mockImage.onerror) {
          mockImage.onerror();
        }
      }, 10);

      const result = await detectionPromise;
      
      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0.5);

      // Restore original Image
      global.Image = originalImage;
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(jscanifyService).toBeInstanceOf(JScanifyService);
    });
  });
});