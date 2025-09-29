/**
 * Tests for SmartPhotoDetector service
 * Tests JScanify integration and fallback scenarios
 */

import { SmartPhotoDetector } from './SmartPhotoDetector';
import { jscanifyService } from './jscanifyService';

// Mock JScanify service
jest.mock('./jscanifyService', () => ({
  jscanifyService: {
    initialize: jest.fn(),
    isInitialized: jest.fn(),
    detectPhotoBoundaries: jest.fn()
  }
}));

const mockJScanifyService = jscanifyService as jest.Mocked<typeof jscanifyService>;

describe('SmartPhotoDetector', () => {
  let detector: SmartPhotoDetector;

  beforeEach(() => {
    detector = new SmartPhotoDetector();
    jest.clearAllMocks();
  });

  afterEach(() => {
    detector.dispose();
  });

  describe('initialization', () => {
    it('should initialize successfully when JScanify is available', async () => {
      mockJScanifyService.initialize.mockResolvedValue(true);

      const result = await detector.initialize();

      expect(result).toBe(true);
      expect(mockJScanifyService.initialize).toHaveBeenCalledTimes(1);
      expect(detector.isInitialized()).toBe(true);
    });

    it('should handle initialization failure gracefully', async () => {
      mockJScanifyService.initialize.mockResolvedValue(false);

      const result = await detector.initialize();

      expect(result).toBe(false);
      expect(detector.isInitialized()).toBe(false);
    });

    it('should handle initialization errors gracefully', async () => {
      mockJScanifyService.initialize.mockRejectedValue(new Error('OpenCV not loaded'));

      const result = await detector.initialize();

      expect(result).toBe(false);
      expect(detector.isInitialized()).toBe(false);
    });
  });

  describe('detectPhotoBoundaries', () => {
    const imageData = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
    const imageWidth = 800;
    const imageHeight = 600;

    it('should use JScanify for detection when initialized', async () => {
      // Setup
      mockJScanifyService.initialize.mockResolvedValue(true);
      mockJScanifyService.isInitialized.mockReturnValue(true);
      mockJScanifyService.detectPhotoBoundaries.mockResolvedValue({
        detected: true,
        cropArea: { x: 50, y: 50, width: 700, height: 500 },
        confidence: 0.9
      });

      await detector.initialize();

      // Test
      const result = await detector.detectPhotoBoundaries(imageData, imageWidth, imageHeight);

      // Verify
      expect(mockJScanifyService.detectPhotoBoundaries).toHaveBeenCalledWith(
        imageData,
        imageWidth,
        imageHeight
      );
      expect(result).toEqual({
        detected: true,
        cropArea: { x: 50, y: 50, width: 700, height: 500 },
        confidence: 0.9
      });
    });

    it('should use fallback when JScanify is not initialized', async () => {
      mockJScanifyService.isInitialized.mockReturnValue(false);

      const result = await detector.detectPhotoBoundaries(imageData, imageWidth, imageHeight);

      expect(mockJScanifyService.detectPhotoBoundaries).not.toHaveBeenCalled();
      expect(result).toEqual({
        detected: false,
        cropArea: {
          x: Math.round(imageWidth * 0.1),
          y: Math.round(imageHeight * 0.1),
          width: Math.round(imageWidth * 0.8),
          height: Math.round(imageHeight * 0.8)
        },
        confidence: 0.5
      });
    });

    it('should use fallback when JScanify detection fails', async () => {
      // Setup
      mockJScanifyService.initialize.mockResolvedValue(true);
      mockJScanifyService.isInitialized.mockReturnValue(true);
      mockJScanifyService.detectPhotoBoundaries.mockRejectedValue(new Error('Detection failed'));

      await detector.initialize();

      // Test
      const result = await detector.detectPhotoBoundaries(imageData, imageWidth, imageHeight);

      // Verify fallback is used
      expect(result).toEqual({
        detected: false,
        cropArea: {
          x: Math.round(imageWidth * 0.1),
          y: Math.round(imageHeight * 0.1),
          width: Math.round(imageWidth * 0.8),
          height: Math.round(imageHeight * 0.8)
        },
        confidence: 0.5
      });
    });

    it('should handle low confidence detection results', async () => {
      // Setup
      mockJScanifyService.initialize.mockResolvedValue(true);
      mockJScanifyService.isInitialized.mockReturnValue(true);
      mockJScanifyService.detectPhotoBoundaries.mockResolvedValue({
        detected: true,
        cropArea: { x: 100, y: 100, width: 600, height: 400 },
        confidence: 0.3 // Low confidence
      });

      await detector.initialize();

      // Test
      const result = await detector.detectPhotoBoundaries(imageData, imageWidth, imageHeight);

      // Should still return the result even with low confidence
      expect(result).toEqual({
        detected: true,
        cropArea: { x: 100, y: 100, width: 600, height: 400 },
        confidence: 0.3
      });
    });

    it('should handle detection when not detected but JScanify returns fallback', async () => {
      // Setup
      mockJScanifyService.initialize.mockResolvedValue(true);
      mockJScanifyService.isInitialized.mockReturnValue(true);
      mockJScanifyService.detectPhotoBoundaries.mockResolvedValue({
        detected: false,
        cropArea: { x: 80, y: 60, width: 640, height: 480 },
        confidence: 0.5
      });

      await detector.initialize();

      // Test
      const result = await detector.detectPhotoBoundaries(imageData, imageWidth, imageHeight);

      // Should return JScanify's fallback result
      expect(result).toEqual({
        detected: false,
        cropArea: { x: 80, y: 60, width: 640, height: 480 },
        confidence: 0.5
      });
    });
  });

  describe('isInitialized', () => {
    it('should return false before initialization', () => {
      expect(detector.isInitialized()).toBe(false);
    });

    it('should return true after successful initialization', async () => {
      mockJScanifyService.initialize.mockResolvedValue(true);
      mockJScanifyService.isInitialized.mockReturnValue(true);

      await detector.initialize();

      expect(detector.isInitialized()).toBe(true);
    });

    it('should return false after failed initialization', async () => {
      mockJScanifyService.initialize.mockResolvedValue(false);
      mockJScanifyService.isInitialized.mockReturnValue(false);

      await detector.initialize();

      expect(detector.isInitialized()).toBe(false);
    });
  });

  describe('dispose', () => {
    it('should cleanup resources properly', async () => {
      mockJScanifyService.initialize.mockResolvedValue(true);
      await detector.initialize();

      expect(() => detector.dispose()).not.toThrow();
      expect(detector.isInitialized()).toBe(false);
    });
  });

  describe('fallback behavior', () => {
    it('should provide consistent fallback crop area', async () => {
      const testCases = [
        { width: 800, height: 600 },
        { width: 1920, height: 1080 },
        { width: 400, height: 300 }
      ];

      for (const { width, height } of testCases) {
        const result = await detector.detectPhotoBoundaries('test', width, height);
        
        expect(result.detected).toBe(false);
        expect(result.confidence).toBe(0.5);
        expect(result.cropArea).toEqual({
          x: Math.round(width * 0.1),
          y: Math.round(height * 0.1),
          width: Math.round(width * 0.8),
          height: Math.round(height * 0.8)
        });
      }
    });
  });
});