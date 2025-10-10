/**
 * PerspectiveCorrectionService Tests
 * 
 * Tests the perspective correction service including:
 * - Service initialization
 * - Perspective correction with valid corner points
 * - Error handling and graceful fallbacks
 * - Performance optimization
 */

import { perspectiveCorrectionService, PerspectiveCorrectionService } from '../perspectiveCorrectionService';
import { opencvLoader } from '../opencvLoader';
import type { CornerPoints } from '../../types/jscanify';

// Mock opencvLoader
jest.mock('../opencvLoader', () => ({
  opencvLoader: {
    isReady: jest.fn(),
    loadOpenCV: jest.fn(),
    getOpenCV: jest.fn()
  }
}));

describe('PerspectiveCorrectionService', () => {
  let service: PerspectiveCorrectionService;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Get singleton instance
    service = PerspectiveCorrectionService.getInstance();
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = PerspectiveCorrectionService.getInstance();
      const instance2 = PerspectiveCorrectionService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should return the exported perspectiveCorrectionService instance', () => {
      expect(perspectiveCorrectionService).toBe(service);
    });
  });

  describe('isReady', () => {
    it('should return true when OpenCV is loaded', () => {
      (opencvLoader.isReady as jest.Mock).mockReturnValue(true);
      
      expect(service.isReady()).toBe(true);
    });

    it('should return false when OpenCV is not loaded', () => {
      (opencvLoader.isReady as jest.Mock).mockReturnValue(false);
      
      expect(service.isReady()).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should return true when OpenCV is already loaded', async () => {
      (opencvLoader.isReady as jest.Mock).mockReturnValue(true);
      
      const result = await service.initialize();
      
      expect(result).toBe(true);
      expect(opencvLoader.loadOpenCV).not.toHaveBeenCalled();
    });

    it('should load OpenCV when not already loaded', async () => {
      (opencvLoader.isReady as jest.Mock)
        .mockReturnValueOnce(false)  // Initial check
        .mockReturnValueOnce(true);  // After loading
      (opencvLoader.loadOpenCV as jest.Mock).mockResolvedValue(undefined);
      
      const result = await service.initialize();
      
      expect(result).toBe(true);
      expect(opencvLoader.loadOpenCV).toHaveBeenCalledTimes(1);
    });

    it('should return false when OpenCV loading fails', async () => {
      (opencvLoader.isReady as jest.Mock).mockReturnValue(false);
      (opencvLoader.loadOpenCV as jest.Mock).mockRejectedValue(new Error('Failed to load'));
      
      const result = await service.initialize();
      
      expect(result).toBe(false);
    });
  });

  describe('correctPerspective', () => {
    const mockCornerPoints: CornerPoints = {
      topLeftCorner: { x: 100, y: 100 },
      topRightCorner: { x: 500, y: 120 },
      bottomLeftCorner: { x: 80, y: 400 },
      bottomRightCorner: { x: 520, y: 420 }
    };

    const mockImageData = 'data:image/jpeg;base64,/9j/4AAQSkZJRg...';

    it('should return error when OpenCV is not available', async () => {
      (opencvLoader.isReady as jest.Mock).mockReturnValue(false);
      
      const result = await service.correctPerspective(mockImageData, mockCornerPoints);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('OpenCV.js not available');
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should timeout after specified duration', async () => {
      (opencvLoader.isReady as jest.Mock).mockReturnValue(true);
      (opencvLoader.getOpenCV as jest.Mock).mockReturnValue({
        // Mock OpenCV with slow operations
        imread: jest.fn(() => new Promise(() => {})), // Never resolves
      });
      
      const result = await service.correctPerspective(
        mockImageData,
        mockCornerPoints,
        { timeout: 100 } // 100ms timeout
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(result.processingTime).toBeGreaterThanOrEqual(100);
    }, 10000);

    it('should process image with default quality', async () => {
      const mockCanvas = document.createElement('canvas');
      const mockResult = 'data:image/jpeg;base64,corrected...';
      mockCanvas.toDataURL = jest.fn().mockReturnValue(mockResult);

      // Mock successful OpenCV operations
      const mockMat = {
        delete: jest.fn()
      };

      const mockCV = {
        imread: jest.fn().mockReturnValue(mockMat),
        Mat: jest.fn().mockImplementation(() => ({
          data32F: new Float32Array(8),
          delete: jest.fn()
        })),
        CV_32FC2: 5,
        getPerspectiveTransform: jest.fn().mockReturnValue({ delete: jest.fn() }),
        Size: jest.fn(),
        warpPerspective: jest.fn(),
        INTER_LINEAR: 1,
        BORDER_CONSTANT: 0,
        Scalar: jest.fn(),
        imshow: jest.fn()
      };

      (opencvLoader.isReady as jest.Mock).mockReturnValue(true);
      (opencvLoader.getOpenCV as jest.Mock).mockReturnValue(mockCV);

      // Mock image loading
      global.Image = class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src = '';
        
        constructor() {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      } as never;

      // Mock document.createElement for canvas
      const originalCreateElement = document.createElement.bind(document);
      document.createElement = jest.fn((tagName: string) => {
        if (tagName === 'canvas') {
          return mockCanvas as never;
        }
        return originalCreateElement(tagName);
      });

      const result = await service.correctPerspective(mockImageData, mockCornerPoints);
      
      // Cleanup
      document.createElement = originalCreateElement;

      expect(result.success).toBe(true);
      expect(result.correctedImageData).toBe(mockResult);
      expect(result.processingTime).toBeGreaterThan(0);
      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.95);
    });

    it('should use custom quality setting', async () => {
      const mockCanvas = document.createElement('canvas');
      const mockResult = 'data:image/jpeg;base64,corrected...';
      mockCanvas.toDataURL = jest.fn().mockReturnValue(mockResult);

      // Mock successful OpenCV operations (same as above)
      const mockMat = { delete: jest.fn() };
      const mockCV = {
        imread: jest.fn().mockReturnValue(mockMat),
        Mat: jest.fn().mockImplementation(() => ({
          data32F: new Float32Array(8),
          delete: jest.fn()
        })),
        CV_32FC2: 5,
        getPerspectiveTransform: jest.fn().mockReturnValue({ delete: jest.fn() }),
        Size: jest.fn(),
        warpPerspective: jest.fn(),
        INTER_LINEAR: 1,
        BORDER_CONSTANT: 0,
        Scalar: jest.fn(),
        imshow: jest.fn()
      };

      (opencvLoader.isReady as jest.Mock).mockReturnValue(true);
      (opencvLoader.getOpenCV as jest.Mock).mockReturnValue(mockCV);

      global.Image = class MockImage {
        onload: (() => void) | null = null;
        src = '';
        constructor() {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      } as never;

      const originalCreateElement = document.createElement.bind(document);
      document.createElement = jest.fn((tagName: string) => {
        if (tagName === 'canvas') return mockCanvas as never;
        return originalCreateElement(tagName);
      });

      await service.correctPerspective(mockImageData, mockCornerPoints, { quality: 0.8 });
      
      document.createElement = originalCreateElement;

      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8);
    });

    it('should handle image loading errors gracefully', async () => {
      (opencvLoader.isReady as jest.Mock).mockReturnValue(true);

      global.Image = class MockImage {
        onerror: (() => void) | null = null;
        src = '';
        constructor() {
          setTimeout(() => {
            if (this.onerror) this.onerror();
          }, 0);
        }
      } as never;

      const result = await service.correctPerspective(mockImageData, mockCornerPoints);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
});

