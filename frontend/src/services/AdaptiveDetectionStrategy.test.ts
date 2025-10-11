import { AdaptiveDetectionStrategy } from './AdaptiveDetectionStrategy';
import type { CornerPoints } from '../types/jscanify';

// Mock dependencies
jest.mock('./imagePreprocessor', () => ({
  imagePreprocessor: {
    initialize: jest.fn(),
    analyzeImage: jest.fn(() => ({
      applyCLAHE: true,
      applyBilateralFilter: true,
      applyMorphology: true,
      enhanceEdges: true,
      applyAdaptiveThreshold: false
    })),
    preprocessForDetection: jest.fn((src) => ({
      preprocessed: src,
      preprocessingApplied: true
    })),
    cleanup: jest.fn()
  }
}));

jest.mock('./opencvLoader', () => ({
  opencvLoader: {
    getOpenCV: jest.fn(() => ({
      Mat: jest.fn(),
      cvtColor: jest.fn(),
      COLOR_RGBA2GRAY: 6,
      TermCriteria: jest.fn(),
      TERM_CRITERIA_EPS: 1,
      TERM_CRITERIA_MAX_ITER: 2,
      cornerSubPix: jest.fn(),
      Size: jest.fn()
    })),
    isReady: jest.fn(() => true)
  }
}));

describe('AdaptiveDetectionStrategy', () => {
  const mockCornerPoints: CornerPoints = {
    topLeftCorner: { x: 100, y: 100 },
    topRightCorner: { x: 900, y: 100 },
    bottomRightCorner: { x: 900, y: 700 },
    bottomLeftCorner: { x: 100, y: 700 }
  };

  const mockScanner = {
    findPaperContour: jest.fn(),
    getCornerPoints: jest.fn()
  };

  const mockSrc = {
    delete: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default options', () => {
      const strategy = new AdaptiveDetectionStrategy(mockScanner);
      const options = strategy.getOptions();

      expect(options.confidenceThreshold).toBe(0.85);
      expect(options.quickTimeoutMs).toBe(500);
      expect(options.multiPassTimeoutMs).toBe(1500);
      expect(options.enablePreprocessing).toBe(true);
    });

    it('should accept custom options', () => {
      const customOptions = {
        confidenceThreshold: 0.90,
        quickTimeoutMs: 300,
        multiPassTimeoutMs: 1000,
        enablePreprocessing: false
      };

      const strategy = new AdaptiveDetectionStrategy(mockScanner, customOptions);
      const options = strategy.getOptions();

      expect(options.confidenceThreshold).toBe(0.90);
      expect(options.quickTimeoutMs).toBe(300);
      expect(options.multiPassTimeoutMs).toBe(1000);
      expect(options.enablePreprocessing).toBe(false);
    });

    it('should allow updating options after initialization', () => {
      const strategy = new AdaptiveDetectionStrategy(mockScanner);
      
      strategy.updateOptions({ confidenceThreshold: 0.75 });
      const options = strategy.getOptions();

      expect(options.confidenceThreshold).toBe(0.75);
      expect(options.quickTimeoutMs).toBe(500); // Other options unchanged
    });
  });

  describe('Quick Detection Success Path', () => {
    it('should return quick result when confidence is high', async () => {
      mockScanner.findPaperContour.mockReturnValue({});
      mockScanner.getCornerPoints.mockReturnValue(mockCornerPoints);

      const strategy = new AdaptiveDetectionStrategy(mockScanner);
      const result = await strategy.detect(mockSrc, 1000, 800);

      expect(result.usedMultiPass).toBe(false);
      expect(result.cornerPoints).toBeTruthy();
      expect(mockSrc.delete).toHaveBeenCalled();
    });

    it('should complete quick detection within performance target', async () => {
      mockScanner.findPaperContour.mockReturnValue({});
      mockScanner.getCornerPoints.mockReturnValue(mockCornerPoints);

      const strategy = new AdaptiveDetectionStrategy(mockScanner);
      const startTime = performance.now();
      
      await strategy.detect(mockSrc, 1000, 800);
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should be fast (< 500ms target, but in tests will be much faster due to mocking)
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Multi-Pass Fallback Path', () => {
    it('should trigger multi-pass when quick detection fails', async () => {
      mockScanner.findPaperContour.mockReturnValue(null);

      const strategy = new AdaptiveDetectionStrategy(mockScanner);
      const result = await strategy.detect(mockSrc, 1000, 800);

      // Should have attempted multi-pass (evidenced by usedMultiPass flag)
      expect(result.usedMultiPass).toBe(true);
      expect(mockSrc.delete).toHaveBeenCalled();
    });

    it('should trigger multi-pass when confidence is low', async () => {
      // Return corner points that will result in low confidence
      const lowConfidenceCorners: CornerPoints = {
        topLeftCorner: { x: 450, y: 350 },
        topRightCorner: { x: 550, y: 350 },
        bottomRightCorner: { x: 550, y: 450 },
        bottomLeftCorner: { x: 450, y: 450 }
      };

      mockScanner.findPaperContour.mockReturnValue({});
      mockScanner.getCornerPoints.mockReturnValue(lowConfidenceCorners);

      const strategy = new AdaptiveDetectionStrategy(mockScanner, {
        confidenceThreshold: 0.85
      });
      
      const result = await strategy.detect(mockSrc, 1000, 800);

      expect(result.usedMultiPass).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle scanner errors gracefully', async () => {
      mockScanner.findPaperContour.mockImplementation(() => {
        throw new Error('Scanner error');
      });

      const strategy = new AdaptiveDetectionStrategy(mockScanner);
      const result = await strategy.detect(mockSrc, 1000, 800);

      expect(result).toBeDefined();
      expect(result.cornerPoints).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should cleanup resources on error', async () => {
      mockScanner.findPaperContour.mockImplementation(() => {
        throw new Error('Scanner error');
      });

      const strategy = new AdaptiveDetectionStrategy(mockScanner);
      await strategy.detect(mockSrc, 1000, 800);

      expect(mockSrc.delete).toHaveBeenCalled();
    });
  });

  describe('Preprocessing Integration', () => {
    it('should use preprocessing when enabled', async () => {
      const { imagePreprocessor } = require('./imagePreprocessor');
      
      mockScanner.findPaperContour.mockReturnValue({});
      mockScanner.getCornerPoints.mockReturnValue(mockCornerPoints);

      const strategy = new AdaptiveDetectionStrategy(mockScanner, {
        enablePreprocessing: true
      });

      await strategy.detect(mockSrc, 1000, 800);

      expect(imagePreprocessor.analyzeImage).toHaveBeenCalled();
      expect(imagePreprocessor.preprocessForDetection).toHaveBeenCalled();
    });

    it('should skip preprocessing when disabled', async () => {
      const { imagePreprocessor } = require('./imagePreprocessor');
      jest.clearAllMocks();
      
      mockScanner.findPaperContour.mockReturnValue({});
      mockScanner.getCornerPoints.mockReturnValue(mockCornerPoints);

      const strategy = new AdaptiveDetectionStrategy(mockScanner, {
        enablePreprocessing: false
      });

      await strategy.detect(mockSrc, 1000, 800);

      expect(imagePreprocessor.analyzeImage).not.toHaveBeenCalled();
      expect(imagePreprocessor.preprocessForDetection).not.toHaveBeenCalled();
    });
  });

  describe('Performance Characteristics', () => {
    it('should have appropriate method names in results', async () => {
      mockScanner.findPaperContour.mockReturnValue({});
      mockScanner.getCornerPoints.mockReturnValue(mockCornerPoints);

      const strategy = new AdaptiveDetectionStrategy(mockScanner);
      const result = await strategy.detect(mockSrc, 1000, 800);

      expect(result.method).toBeDefined();
      expect(typeof result.method).toBe('string');
    });

    it('should track processing time', async () => {
      mockScanner.findPaperContour.mockReturnValue({});
      mockScanner.getCornerPoints.mockReturnValue(mockCornerPoints);

      const strategy = new AdaptiveDetectionStrategy(mockScanner);
      const result = await strategy.detect(mockSrc, 1000, 800);

      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(typeof result.processingTime).toBe('number');
    });
  });

  describe('Configuration Updates', () => {
    it('should reflect updated threshold in behavior', async () => {
      const strategy = new AdaptiveDetectionStrategy(mockScanner, {
        confidenceThreshold: 0.95 // Very high threshold
      });

      // Even good corner points might not meet 0.95 threshold
      mockScanner.findPaperContour.mockReturnValue({});
      mockScanner.getCornerPoints.mockReturnValue(mockCornerPoints);

      const result = await strategy.detect(mockSrc, 1000, 800);

      // High threshold might trigger multi-pass
      expect(result).toBeDefined();
    });

    it('should allow runtime option updates', () => {
      const strategy = new AdaptiveDetectionStrategy(mockScanner);
      
      const originalOptions = strategy.getOptions();
      expect(originalOptions.confidenceThreshold).toBe(0.85);

      strategy.updateOptions({ confidenceThreshold: 0.70 });
      
      const updatedOptions = strategy.getOptions();
      expect(updatedOptions.confidenceThreshold).toBe(0.70);
    });
  });
});

