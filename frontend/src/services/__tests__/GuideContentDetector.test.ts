/**
 * GuideContentDetector Unit Tests
 * 
 * Tests for the GuideContentDetector service including:
 * - Real-time detection functionality
 * - Smart hiding logic
 * - Detection state management
 * - Confidence scoring
 * - Integration with JScanify
 */

import { GuideContentDetector } from '../GuideContentDetector';
import { jscanifyService } from '../jscanifyService';

// Mock JScanify service
jest.mock('../jscanifyService', () => ({
  jscanifyService: {
    initialize: jest.fn(),
    detectPhotoBoundaries: jest.fn()
  }
}));

const mockJScanifyService = jscanifyService as jest.Mocked<typeof jscanifyService>;

describe('GuideContentDetector', () => {
  let detector: GuideContentDetector;
  let mockVideoElement: Partial<HTMLVideoElement>;
  let mockCanvas: Partial<HTMLCanvasElement>;
  let mockContext: Partial<CanvasRenderingContext2D>;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    detector = new GuideContentDetector();
    
    // Mock video element
    mockVideoElement = {
      videoWidth: 1920,
      videoHeight: 1080,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    } as Partial<HTMLCanvasElement>;

    // Mock canvas and context
    mockCanvas = {
      width: 1920,
      height: 1080,
      getContext: jest.fn()
    } as Partial<HTMLCanvasElement>;

    mockContext = {
      drawImage: jest.fn()
    } as Partial<CanvasRenderingContext2D>;

    mockCanvas.getContext = jest.fn().mockReturnValue(mockContext);
    
    // Mock document.createElement
    jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'canvas') {
        return mockCanvas;
      }
      return document.createElement(tagName);
    });

    // Mock canvas.toDataURL
    mockCanvas.toDataURL = jest.fn().mockReturnValue('data:image/jpeg;base64,mockdata');

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    detector.destroy();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      mockJScanifyService.initialize.mockResolvedValue(true);

      const result = await detector.initialize();

      expect(result).toBe(true);
      expect(mockJScanifyService.initialize).toHaveBeenCalled();
      expect(detector.isReady()).toBe(true);
    });

    it('should handle initialization failure', async () => {
      mockJScanifyService.initialize.mockRejectedValue(new Error('Initialization failed'));

      const result = await detector.initialize();

      expect(result).toBe(false);
      expect(detector.isReady()).toBe(false);
    });
  });

  describe('Real-time Detection', () => {
    beforeEach(async () => {
      mockJScanifyService.initialize.mockResolvedValue(true);
      await detector.initialize();
    });

    it('should start and stop real-time detection', () => {
      const mockCallback = jest.fn();
      const portraitCorners = {
        topLeft: { x: 100, y: 100 },
        topRight: { x: 300, y: 100 },
        bottomLeft: { x: 100, y: 400 },
        bottomRight: { x: 300, y: 400 }
      };
      const landscapeCorners = {
        topLeft: { x: 200, y: 150 },
        topRight: { x: 500, y: 150 },
        bottomLeft: { x: 200, y: 350 },
        bottomRight: { x: 500, y: 350 }
      };

      detector.startRealTimeDetection(mockVideoElement, portraitCorners, landscapeCorners, mockCallback);
      
      // Should not throw error
      expect(() => detector.stopRealTimeDetection()).not.toThrow();
    });

    it('should not start detection if not initialized', () => {
      const uninitializedDetector = new GuideContentDetector();
      const mockCallback = jest.fn();
      const portraitCorners = {
        topLeft: { x: 100, y: 100 },
        topRight: { x: 300, y: 100 },
        bottomLeft: { x: 100, y: 400 },
        bottomRight: { x: 300, y: 400 }
      };
      const landscapeCorners = {
        topLeft: { x: 200, y: 150 },
        topRight: { x: 500, y: 150 },
        bottomLeft: { x: 200, y: 350 },
        bottomRight: { x: 500, y: 350 }
      };

      uninitializedDetector.startRealTimeDetection(mockVideoElement, portraitCorners, landscapeCorners, mockCallback);
      
      // Should not call the callback
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('Content Detection', () => {
    beforeEach(async () => {
      mockJScanifyService.initialize.mockResolvedValue(true);
      await detector.initialize();
    });

    it('should detect content in guides successfully', async () => {
      const portraitCorners = {
        topLeft: { x: 100, y: 100 },
        topRight: { x: 300, y: 100 },
        bottomLeft: { x: 100, y: 400 },
        bottomRight: { x: 300, y: 400 }
      };
      const landscapeCorners = {
        topLeft: { x: 200, y: 150 },
        topRight: { x: 500, y: 150 },
        bottomLeft: { x: 200, y: 350 },
        bottomRight: { x: 500, y: 350 }
      };

      // Mock successful detection for portrait
      mockJScanifyService.detectPhotoBoundaries.mockResolvedValueOnce({
        detected: true,
        confidence: 0.8,
        cropArea: { x: 0, y: 0, width: 200, height: 300 },
        cornerPoints: {
          topLeftCorner: { x: 0, y: 0 },
          topRightCorner: { x: 200, y: 0 },
          bottomLeftCorner: { x: 0, y: 300 },
          bottomRightCorner: { x: 200, y: 300 }
        },
        metrics: {
          areaRatio: 0.7,
          edgeRatio: 0.8,
          minDistance: 10
        }
      });

      // Mock no detection for landscape
      mockJScanifyService.detectPhotoBoundaries.mockResolvedValueOnce({
        detected: false,
        confidence: 0.3,
        cropArea: { x: 0, y: 0, width: 0, height: 0 },
        cornerPoints: null,
        metrics: {
          areaRatio: 0.1,
          edgeRatio: 0.2,
          minDistance: 5
        }
      });

      const result = await detector.detectContentInGuides(mockVideoElement, portraitCorners, landscapeCorners);

      expect(result.orientation).toBe('portrait');
      expect(result.isDetected).toBe(true);
      expect(result.confidence).toBe(0.8);
      expect(result.detectionSource).toBe('jscanify');
    });

    it('should handle detection errors gracefully', async () => {
      const portraitCorners = {
        topLeft: { x: 100, y: 100 },
        topRight: { x: 300, y: 100 },
        bottomLeft: { x: 100, y: 400 },
        bottomRight: { x: 300, y: 400 }
      };
      const landscapeCorners = {
        topLeft: { x: 200, y: 150 },
        topRight: { x: 500, y: 150 },
        bottomLeft: { x: 200, y: 350 },
        bottomRight: { x: 500, y: 350 }
      };

      // Mock detection failure
      mockJScanifyService.detectPhotoBoundaries.mockRejectedValue(new Error('Detection failed'));

      const result = await detector.detectContentInGuides(mockVideoElement, portraitCorners, landscapeCorners);

      expect(result.orientation).toBe(null);
      expect(result.isDetected).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.detectionSource).toBe('none');
    });
  });

  describe('Smart Hiding Logic', () => {
    beforeEach(async () => {
      mockJScanifyService.initialize.mockResolvedValue(true);
      await detector.initialize();
    });

    it('should hide portrait guide when landscape is detected', async () => {
      const portraitCorners = {
        topLeft: { x: 100, y: 100 },
        topRight: { x: 300, y: 100 },
        bottomLeft: { x: 100, y: 400 },
        bottomRight: { x: 300, y: 400 }
      };
      const landscapeCorners = {
        topLeft: { x: 200, y: 150 },
        topRight: { x: 500, y: 150 },
        bottomLeft: { x: 200, y: 350 },
        bottomRight: { x: 500, y: 350 }
      };

      // Mock JScanify detection - wide object (landscape orientation)
      mockJScanifyService.detectPhotoBoundaries
        .mockResolvedValueOnce({ // Wide object (aspect ratio > 1.2)
          detected: true,
          confidence: 0.9,
          cropArea: { x: 0, y: 0, width: 300, height: 200 }, // Wide rectangle
          cornerPoints: {
            topLeftCorner: { x: 0, y: 0 },
            topRightCorner: { x: 300, y: 0 },
            bottomLeftCorner: { x: 0, y: 200 },
            bottomRightCorner: { x: 300, y: 200 }
          },
          metrics: { areaRatio: 0.8, edgeRatio: 0.9, minDistance: 15 }
        });

      await detector.detectContentInGuides(mockVideoElement, portraitCorners, landscapeCorners);

      expect(detector.shouldHideGuide('portrait')).toBe(true);
      expect(detector.shouldHideGuide('landscape')).toBe(false);
    });

    it('should hide landscape guide when portrait is detected', async () => {
      const portraitCorners = {
        topLeft: { x: 100, y: 100 },
        topRight: { x: 300, y: 100 },
        bottomLeft: { x: 100, y: 400 },
        bottomRight: { x: 300, y: 400 }
      };
      const landscapeCorners = {
        topLeft: { x: 200, y: 150 },
        topRight: { x: 500, y: 150 },
        bottomLeft: { x: 200, y: 350 },
        bottomRight: { x: 500, y: 350 }
      };

      // Mock JScanify detection - single call that detects photo within portrait guide
      mockJScanifyService.detectPhotoBoundaries
        .mockResolvedValueOnce({ // Detected photo within portrait guide area
          detected: true,
          confidence: 0.9,
          cropArea: { x: 120, y: 120, width: 160, height: 240 },
          cornerPoints: {
            topLeftCorner: { x: 120, y: 120 },
            topRightCorner: { x: 280, y: 120 },
            bottomLeftCorner: { x: 120, y: 360 },
            bottomRightCorner: { x: 280, y: 360 }
          },
          metrics: { areaRatio: 0.8, edgeRatio: 0.9, minDistance: 15 }
        });

      await detector.detectContentInGuides(mockVideoElement, portraitCorners, landscapeCorners);


      expect(detector.shouldHideGuide('portrait')).toBe(false);
      expect(detector.shouldHideGuide('landscape')).toBe(true);
    });

    it('should show both guides when no content is detected', async () => {
      const portraitCorners = {
        topLeft: { x: 100, y: 100 },
        topRight: { x: 300, y: 100 },
        bottomLeft: { x: 100, y: 400 },
        bottomRight: { x: 300, y: 400 }
      };
      const landscapeCorners = {
        topLeft: { x: 200, y: 150 },
        topRight: { x: 500, y: 150 },
        bottomLeft: { x: 200, y: 350 },
        bottomRight: { x: 500, y: 350 }
      };

      // Mock no detection
      mockJScanifyService.detectPhotoBoundaries
        .mockResolvedValueOnce({
          detected: false,
          confidence: 0.2,
          cropArea: { x: 0, y: 0, width: 0, height: 0 },
          cornerPoints: null,
          metrics: { areaRatio: 0.1, edgeRatio: 0.1, minDistance: 5 }
        });

      await detector.detectContentInGuides(mockVideoElement, portraitCorners, landscapeCorners);

      const state = detector.getDetectionState();
      expect(state.activeOrientation).toBe(null);
      expect(detector.shouldHideGuide('portrait')).toBe(false);
      expect(detector.shouldHideGuide('landscape')).toBe(false);
    });
  });

  describe('Detection State Management', () => {
    beforeEach(async () => {
      mockJScanifyService.initialize.mockResolvedValue(true);
      await detector.initialize();
    });

    it('should update detection state correctly', async () => {
      const portraitCorners = {
        topLeft: { x: 100, y: 100 },
        topRight: { x: 300, y: 100 },
        bottomLeft: { x: 100, y: 400 },
        bottomRight: { x: 300, y: 400 }
      };
      const landscapeCorners = {
        topLeft: { x: 200, y: 150 },
        topRight: { x: 500, y: 150 },
        bottomLeft: { x: 200, y: 350 },
        bottomRight: { x: 500, y: 350 }
      };

      // Mock portrait detection
      mockJScanifyService.detectPhotoBoundaries
        .mockResolvedValueOnce({
          detected: true,
          confidence: 0.8,
          cropArea: { x: 0, y: 0, width: 200, height: 300 }, // Tall rectangle (portrait)
          cornerPoints: {
            topLeftCorner: { x: 0, y: 0 },
            topRightCorner: { x: 200, y: 0 },
            bottomLeftCorner: { x: 0, y: 300 },
            bottomRightCorner: { x: 200, y: 300 }
          },
          metrics: { areaRatio: 0.7, edgeRatio: 0.8, minDistance: 10 }
        });

      await detector.detectContentInGuides(mockVideoElement, portraitCorners, landscapeCorners);

      const state = detector.getDetectionState();
      expect(state.portrait.isDetected).toBe(true);
      expect(state.portrait.confidence).toBe(0.8);
      expect(state.landscape.isDetected).toBe(false);
      expect(state.landscape.confidence).toBe(0);
      expect(state.activeOrientation).toBe('portrait');
    });

    it('should clear active orientation after timeout', async () => {
      const portraitCorners = {
        topLeft: { x: 100, y: 100 },
        topRight: { x: 300, y: 100 },
        bottomLeft: { x: 100, y: 400 },
        bottomRight: { x: 300, y: 400 }
      };
      const landscapeCorners = {
        topLeft: { x: 200, y: 150 },
        topRight: { x: 500, y: 150 },
        bottomLeft: { x: 200, y: 350 },
        bottomRight: { x: 500, y: 350 }
      };

      // Mock detection
      mockJScanifyService.detectPhotoBoundaries
        .mockResolvedValueOnce({
          detected: true,
          confidence: 0.8,
          cropArea: { x: 0, y: 0, width: 200, height: 300 }, // Tall rectangle (portrait)
          cornerPoints: {
            topLeftCorner: { x: 0, y: 0 },
            topRightCorner: { x: 200, y: 0 },
            bottomLeftCorner: { x: 0, y: 300 },
            bottomRightCorner: { x: 200, y: 300 }
          },
          metrics: { areaRatio: 0.7, edgeRatio: 0.8, minDistance: 10 }
        });

      await detector.detectContentInGuides(mockVideoElement, portraitCorners, landscapeCorners);

      let state = detector.getDetectionState();
      expect(state.activeOrientation).toBe('portrait');

      // Simulate timeout by advancing time
      jest.advanceTimersByTime(3000); // 3 seconds

      // Manually set the lastDetection times to simulate timeout
      const now = Date.now();
      detector['detectionState'].portrait.lastDetection = now - 3000; // 3 seconds ago
      detector['detectionState'].landscape.lastDetection = now - 3000; // 3 seconds ago

      // Directly call the timeout check method
      detector['checkForTimeout']();

      state = detector.getDetectionState();
      expect(state.activeOrientation).toBe(null);
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources properly', async () => {
      mockJScanifyService.initialize.mockResolvedValue(true);
      await detector.initialize();

      const mockCallback = jest.fn();
      const portraitCorners = {
        topLeft: { x: 100, y: 100 },
        topRight: { x: 300, y: 100 },
        bottomLeft: { x: 100, y: 400 },
        bottomRight: { x: 300, y: 400 }
      };
      const landscapeCorners = {
        topLeft: { x: 200, y: 150 },
        topRight: { x: 500, y: 150 },
        bottomLeft: { x: 200, y: 350 },
        bottomRight: { x: 500, y: 350 }
      };

      detector.startRealTimeDetection(mockVideoElement, portraitCorners, landscapeCorners, mockCallback);
      detector.destroy();

      expect(detector.isReady()).toBe(false);
    });
  });
});
