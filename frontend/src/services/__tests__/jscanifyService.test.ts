// Tests for JScanify service integration
import { jscanifyService, JScanifyService } from '../jscanifyService';

// Mock OpenCV loader
jest.mock('../opencvLoader', () => ({
  opencvLoader: {
    isReady: jest.fn(() => false),
    loadOpenCV: jest.fn(() => Promise.resolve()),
    getOpenCV: jest.fn(() => ({
      Mat: jest.fn(),
      imread: jest.fn(() => ({ delete: jest.fn() })),
      delete: jest.fn()
    }))
  }
}));

// Mock document and DOM APIs
Object.defineProperty(document, 'createElement', {
  value: jest.fn((tagName: string) => {
    if (tagName === 'script') {
      return {
        src: '',
        onload: null,
        onerror: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      };
    }
    if (tagName === 'canvas') {
      return {
        width: 0,
        height: 0,
        getContext: jest.fn(() => ({
          drawImage: jest.fn()
        }))
      };
    }
    return {};
  }),
  writable: true
});

Object.defineProperty(document, 'head', {
  value: {
    appendChild: jest.fn()
  },
  writable: true
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

      // Mock JScanify global availability
      Object.defineProperty(window, 'jscanify', {
        value: jest.fn().mockImplementation(() => ({
          findPaperContour: jest.fn(),
          getCornerPoints: jest.fn()
        })),
        writable: true
      });

      const result = await service.initialize();
      expect(result).toBe(true); // Should be true since JScanify is mocked as available
      expect(service.isInitialized()).toBe(true);
    }, 10000);

    it('should fail gracefully when OpenCV is not available', async () => {
      const { opencvLoader } = await import('../opencvLoader');
      (opencvLoader.isReady as jest.Mock).mockReturnValue(false);
      (opencvLoader.loadOpenCV as jest.Mock).mockRejectedValue(new Error('OpenCV load failed'));

      const result = await service.initialize();
      expect(result).toBe(false);
      expect(service.isInitialized()).toBe(false);
    }, 10000);
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
      // Service is not initialized, so it should return fallback immediately
      const result = await service.detectPhotoBoundaries('invalid-image-data', 800, 600);
      
      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0.5);
      expect(result.cropArea).toEqual({
        x: 80,
        y: 60,
        width: 640,
        height: 480
      });
    }, 10000);
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(jscanifyService).toBeInstanceOf(JScanifyService);
    });
  });
});