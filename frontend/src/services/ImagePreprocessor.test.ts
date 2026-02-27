/**
 * Tests for ImagePreprocessor service
 * Task 5.6: Enhanced smart cropping accuracy with advanced preprocessing
 */

import { ImagePreprocessor, PreprocessingOptions } from './ImagePreprocessor';
import { opencvLoader } from './opencvLoader';

// Mock opencvLoader
jest.mock('./opencvLoader', () => ({
  opencvLoader: {
    isReady: jest.fn(),
    loadOpenCV: jest.fn(),
    getOpenCV: jest.fn()
  }
}));

describe('ImagePreprocessor', () => {
  let preprocessor: ImagePreprocessor;
  let mockCv: {
    Mat: jest.Mock;
    cvtColor: jest.Mock;
    mean: jest.Mock;
    CLAHE: jest.Mock;
    Size: jest.Mock;
    bilateralFilter: jest.Mock;
    GaussianBlur: jest.Mock;
    addWeighted: jest.Mock;
    ones: jest.Mock;
    morphologyEx: jest.Mock;
    adaptiveThreshold: jest.Mock;
    COLOR_RGBA2GRAY: number;
    COLOR_GRAY2RGBA: number;
    BORDER_DEFAULT: number;
    MORPH_CLOSE: number;
    MORPH_OPEN: number;
    ADAPTIVE_THRESH_MEAN_C: number;
    THRESH_BINARY: number;
    CV_8U: number;
  };

  beforeEach(() => {
    preprocessor = new ImagePreprocessor();

    // Create mock OpenCV
    mockCv = {
      Mat: jest.fn().mockImplementation(() => ({
        clone: jest.fn().mockReturnThis(),
        copyTo: jest.fn(),
        delete: jest.fn(),
        channels: jest.fn().mockReturnValue(4),
        rows: 100,
        cols: 100
      })),
      cvtColor: jest.fn(),
      mean: jest.fn().mockReturnValue([128, 128, 128, 255]),
      CLAHE: jest.fn().mockImplementation(() => ({
        apply: jest.fn(),
        delete: jest.fn()
      })),
      Size: jest.fn(),
      bilateralFilter: jest.fn(),
      GaussianBlur: jest.fn(),
      addWeighted: jest.fn(),
      ones: jest.fn().mockReturnValue({
        delete: jest.fn()
      }),
      morphologyEx: jest.fn(),
      adaptiveThreshold: jest.fn(),
      COLOR_RGBA2GRAY: 6,
      COLOR_GRAY2RGBA: 2,
      BORDER_DEFAULT: 4,
      MORPH_CLOSE: 3,
      MORPH_OPEN: 2,
      ADAPTIVE_THRESH_MEAN_C: 0,
      THRESH_BINARY: 0,
      CV_8U: 0
    };

    (opencvLoader.isReady as jest.Mock).mockReturnValue(true);
    (opencvLoader.getOpenCV as jest.Mock).mockReturnValue(mockCv);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully when OpenCV is ready', async () => {
      (opencvLoader.isReady as jest.Mock).mockReturnValue(true);
      
      const result = await preprocessor.initialize();
      
      expect(result).toBe(true);
      expect(opencvLoader.getOpenCV).toHaveBeenCalled();
    });

    it('should load OpenCV if not ready', async () => {
      (opencvLoader.isReady as jest.Mock).mockReturnValue(false);
      (opencvLoader.loadOpenCV as jest.Mock).mockResolvedValue(undefined);
      
      const result = await preprocessor.initialize();
      
      expect(result).toBe(true);
      expect(opencvLoader.loadOpenCV).toHaveBeenCalled();
    });

    it('should return false on initialization failure', async () => {
      (opencvLoader.isReady as jest.Mock).mockReturnValue(false);
      (opencvLoader.loadOpenCV as jest.Mock).mockRejectedValue(new Error('Load failed'));
      
      const result = await preprocessor.initialize();
      
      expect(result).toBe(false);
    });
  });

  describe('preprocessForDetection', () => {
    let mockSrc: { clone: jest.Mock; delete: jest.Mock };

    beforeEach(async () => {
      await preprocessor.initialize();
      
      mockSrc = {
        clone: jest.fn().mockReturnValue({
          delete: jest.fn()
        }),
        delete: jest.fn()
      };
    });

    it('should apply all default preprocessing techniques', () => {
      const result = preprocessor.preprocessForDetection(mockSrc);
      
      expect(result.needsCleanup).toBe(true);
      expect(result.appliedTechniques).toContain('CLAHE');
      expect(result.appliedTechniques).toContain('BilateralFilter');
      expect(result.appliedTechniques).toContain('EdgeEnhancement');
      expect(result.appliedTechniques).toContain('Morphology');
      expect(result.appliedTechniques).not.toContain('AdaptiveThreshold');
    });

    it('should apply only selected techniques when options provided', () => {
      const options: PreprocessingOptions = {
        applyCLAHE: true,
        applyBilateralFilter: false,
        applyMorphology: false,
        enhanceEdges: false,
        applyAdaptiveThreshold: false
      };
      
      const result = preprocessor.preprocessForDetection(mockSrc, options);
      
      expect(result.appliedTechniques).toContain('CLAHE');
      expect(result.appliedTechniques).not.toContain('BilateralFilter');
      expect(result.appliedTechniques).not.toContain('Morphology');
    });

    it('should apply adaptive thresholding when enabled', () => {
      const options: PreprocessingOptions = {
        applyCLAHE: false,
        applyBilateralFilter: false,
        applyMorphology: false,
        enhanceEdges: false,
        applyAdaptiveThreshold: true
      };
      
      const result = preprocessor.preprocessForDetection(mockSrc, options);
      
      expect(result.appliedTechniques).toContain('AdaptiveThreshold');
    });

    it('should handle preprocessing errors gracefully', () => {
      mockSrc.clone = jest.fn().mockImplementation(() => {
        throw new Error('Clone failed');
      });
      
      const result = preprocessor.preprocessForDetection(mockSrc);
      
      expect(result.needsCleanup).toBe(false);
      expect(result.appliedTechniques).toContain('None (fallback)');
      expect(result.preprocessed).toBe(mockSrc);
    });

    it('should log applied techniques', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      preprocessor.preprocessForDetection(mockSrc);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Preprocessing applied:'),
        expect.any(String)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('calculateMedianIntensity', () => {
    beforeEach(async () => {
      await preprocessor.initialize();
    });

    it('should calculate intensity for grayscale image', () => {
      const mockSrc = {
        channels: jest.fn().mockReturnValue(1)
      };
      
      mockCv.mean.mockReturnValue([128, 0, 0, 0]);
      
      const intensity = preprocessor.calculateMedianIntensity(mockSrc);
      
      expect(intensity).toBe(128);
    });

    it('should convert RGBA to grayscale and calculate intensity', () => {
      const mockSrc = {
        channels: jest.fn().mockReturnValue(4)
      };
      
      const mockGray = {
        delete: jest.fn()
      };
      
      mockCv.Mat = jest.fn().mockReturnValue(mockGray);
      mockCv.mean.mockReturnValue([150, 0, 0, 0]);
      
      const intensity = preprocessor.calculateMedianIntensity(mockSrc);
      
      expect(intensity).toBe(150);
      expect(mockCv.cvtColor).toHaveBeenCalled();
      expect(mockGray.delete).toHaveBeenCalled();
    });

    it('should return default intensity on error', () => {
      const mockSrc = {
        channels: jest.fn().mockImplementation(() => {
          throw new Error('Error');
        })
      };
      
      const intensity = preprocessor.calculateMedianIntensity(mockSrc);
      
      expect(intensity).toBe(128);
    });
  });

  describe('analyzeImage', () => {
    beforeEach(async () => {
      await preprocessor.initialize();
    });

    it('should recommend standard preprocessing for normal lighting', () => {
      const mockSrc = {};
      mockCv.mean.mockReturnValue([128, 0, 0, 0]);
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const options = preprocessor.analyzeImage(mockSrc);
      
      expect(options.applyCLAHE).toBe(true);
      expect(options.applyBilateralFilter).toBe(true);
      expect(options.applyMorphology).toBe(true);
      expect(options.enhanceEdges).toBe(true);
      expect(options.applyAdaptiveThreshold).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Normal lighting')
      );
      
      consoleSpy.mockRestore();
    });

    it('should recommend aggressive preprocessing for dark images', () => {
      const mockSrc = {
        channels: jest.fn().mockReturnValue(4)
      };
      
      const mockGray = {
        delete: jest.fn()
      };
      
      mockCv.Mat = jest.fn().mockReturnValue(mockGray);
      mockCv.mean.mockReturnValue([50, 0, 0, 0]); // Dark image
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const options = preprocessor.analyzeImage(mockSrc);
      
      expect(options.applyAdaptiveThreshold).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Dark image detected')
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle bright images appropriately', () => {
      const mockSrc = {
        channels: jest.fn().mockReturnValue(4)
      };
      
      const mockGray = {
        delete: jest.fn()
      };
      
      mockCv.Mat = jest.fn().mockReturnValue(mockGray);
      mockCv.mean.mockReturnValue([220, 0, 0, 0]); // Bright image
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const options = preprocessor.analyzeImage(mockSrc);
      
      expect(options.applyCLAHE).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Bright image detected')
      );
      
      consoleSpy.mockRestore();
    });

    it('should return default options on analysis error', () => {
      const mockSrc = {};
      mockCv.mean.mockImplementation(() => {
        throw new Error('Analysis failed');
      });
      
      const options = preprocessor.analyzeImage(mockSrc);
      
      expect(options).toEqual({
        applyCLAHE: true,
        applyBilateralFilter: true,
        applyMorphology: true,
        enhanceEdges: true,
        applyAdaptiveThreshold: false
      });
    });
  });

  describe('cleanup', () => {
    it('should delete preprocessed Mat when cleanup is needed', () => {
      const mockPreprocessed = {
        delete: jest.fn()
      };
      const mockOriginal = {
        delete: jest.fn()
      };
      
      const result = {
        preprocessed: mockPreprocessed,
        originalCloned: mockOriginal,
        needsCleanup: true,
        appliedTechniques: ['CLAHE']
      };
      
      preprocessor.cleanup(result);
      
      expect(mockPreprocessed.delete).toHaveBeenCalled();
      expect(mockOriginal.delete).toHaveBeenCalled();
    });

    it('should not delete when cleanup is not needed', () => {
      const mockPreprocessed = {
        delete: jest.fn()
      };
      
      const result = {
        preprocessed: mockPreprocessed,
        originalCloned: null,
        needsCleanup: false,
        appliedTechniques: []
      };
      
      preprocessor.cleanup(result);
      
      expect(mockPreprocessed.delete).not.toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', () => {
      const mockPreprocessed = {
        delete: jest.fn().mockImplementation(() => {
          throw new Error('Delete failed');
        })
      };
      
      const result = {
        preprocessed: mockPreprocessed,
        originalCloned: null,
        needsCleanup: true,
        appliedTechniques: []
      };
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      expect(() => preprocessor.cleanup(result)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleanup failed'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('integration scenarios', () => {
    beforeEach(async () => {
      await preprocessor.initialize();
    });

    it('should handle poor lighting scenario', () => {
      const mockSrc = {
        clone: jest.fn().mockReturnValue({
          delete: jest.fn()
        }),
        channels: jest.fn().mockReturnValue(4)
      };
      
      // Simulate dark image
      mockCv.mean.mockReturnValue([40, 0, 0, 0]);
      
      const options = preprocessor.analyzeImage(mockSrc);
      const result = preprocessor.preprocessForDetection(mockSrc, options);
      
      expect(result.appliedTechniques).toContain('CLAHE');
      expect(result.appliedTechniques).toContain('AdaptiveThreshold');
    });

    it('should handle noisy image scenario', () => {
      const mockSrc = {
        clone: jest.fn().mockReturnValue({
          delete: jest.fn()
        }),
        channels: jest.fn().mockReturnValue(4)
      };
      
      const options: PreprocessingOptions = {
        applyCLAHE: true,
        applyBilateralFilter: true,
        applyMorphology: true,
        enhanceEdges: true,
        applyAdaptiveThreshold: false
      };
      
      const result = preprocessor.preprocessForDetection(mockSrc, options);
      
      expect(result.appliedTechniques).toContain('BilateralFilter');
      expect(result.appliedTechniques).toContain('Morphology');
    });

    it('should handle low contrast scenario', () => {
      const mockSrc = {
        clone: jest.fn().mockReturnValue({
          delete: jest.fn()
        }),
        channels: jest.fn().mockReturnValue(4)
      };
      
      const options: PreprocessingOptions = {
        applyCLAHE: true,
        applyBilateralFilter: true,
        applyMorphology: true,
        enhanceEdges: true,
        applyAdaptiveThreshold: false
      };
      
      const result = preprocessor.preprocessForDetection(mockSrc, options);
      
      expect(result.appliedTechniques).toContain('CLAHE');
      expect(result.appliedTechniques).toContain('EdgeEnhancement');
    });
  });

  describe('performance characteristics', () => {
    beforeEach(async () => {
      await preprocessor.initialize();
    });

    it('should complete preprocessing quickly', () => {
      const mockSrc = {
        clone: jest.fn().mockReturnValue({
          delete: jest.fn()
        })
      };
      
      const startTime = performance.now();
      preprocessor.preprocessForDetection(mockSrc);
      const endTime = performance.now();
      
      // Should complete in reasonable time (< 100ms for mocked operations)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should not leak memory by cleaning up all Mats', () => {
      const mockSrc = {
        clone: jest.fn().mockReturnValue({
          delete: jest.fn()
        })
      };
      
      const result = preprocessor.preprocessForDetection(mockSrc);
      preprocessor.cleanup(result);
      
      // Verify cleanup was called
      expect(result.preprocessed).toBeDefined();
      expect(result.needsCleanup).toBe(true);
    });
  });
});

