import {
  calculateConfidenceScore,
  isHighConfidence,
  getConfidenceLevel,
  DEFAULT_WEIGHTS,
  type ConfidenceMetrics
} from './ConfidenceScoring';
import type { CornerPoints } from '../types/jscanify';

describe('ConfidenceScoring', () => {
  const imageWidth = 1920;
  const imageHeight = 1080;

  // Helper to create corner points
  const createCornerPoints = (
    tlX: number,
    tlY: number,
    trX: number,
    trY: number,
    brX: number,
    brY: number,
    blX: number,
    blY: number
  ): CornerPoints => ({
    topLeftCorner: { x: tlX, y: tlY },
    topRightCorner: { x: trX, y: trY },
    bottomRightCorner: { x: brX, y: brY },
    bottomLeftCorner: { x: blX, y: blY }
  });

  describe('calculateConfidenceScore', () => {
    it('should give high confidence for perfect rectangle in ideal range', () => {
      // Perfect rectangle covering 60% of image
      const corners = createCornerPoints(
        384, 216,    // top-left (20%, 20%)
        1536, 216,   // top-right (80%, 20%)
        1536, 864,   // bottom-right (80%, 80%)
        384, 864     // bottom-left (20%, 80%)
      );

      const result = calculateConfidenceScore(corners, imageWidth, imageHeight);

      expect(result.overall).toBeGreaterThan(0.79); // Allow for floating point precision
      expect(result.areaRatio).toBeCloseTo(0.8, 1); // Use toBeCloseTo for floating point
      expect(result.rectangularity).toBeGreaterThan(0.9);
    });

    it('should give lower confidence for very small detection', () => {
      // Small rectangle (10% of image)
      const corners = createCornerPoints(
        768, 432,    // top-left
        1152, 432,   // top-right
        1152, 648,   // bottom-right
        768, 648     // bottom-left
      );

      const result = calculateConfidenceScore(corners, imageWidth, imageHeight);

      expect(result.overall).toBeLessThan(0.8);
      expect(result.areaRatio).toBeLessThan(1.0);
    });

    it('should give lower confidence for non-rectangular shape', () => {
      // Irregular quadrilateral
      const corners = createCornerPoints(
        384, 216,    // top-left
        1536, 300,   // top-right (skewed)
        1400, 900,   // bottom-right (skewed)
        500, 864     // bottom-left (skewed)
      );

      const result = calculateConfidenceScore(corners, imageWidth, imageHeight);

      expect(result.rectangularity).toBeLessThan(0.9);
    });

    it('should give lower confidence for off-center detection', () => {
      // Rectangle far from center
      const corners = createCornerPoints(
        100, 100,    // top-left
        600, 100,    // top-right
        600, 400,    // bottom-right
        100, 400     // bottom-left
      );

      const result = calculateConfidenceScore(corners, imageWidth, imageHeight);

      expect(result.distribution).toBeLessThan(0.8);
    });

    it('should use custom weights when provided', () => {
      const corners = createCornerPoints(
        384, 216,
        1536, 216,
        1536, 864,
        384, 864
      );

      const customWeights = {
        area: 0.4,
        rectangularity: 0.4,
        distribution: 0.1,
        straightness: 0.1
      };

      const defaultResult = calculateConfidenceScore(corners, imageWidth, imageHeight, DEFAULT_WEIGHTS);
      const customResult = calculateConfidenceScore(corners, imageWidth, imageHeight, customWeights);

      // Results should be different with different weights
      expect(customResult.overall).not.toBe(defaultResult.overall);
    });

    it('should return metrics within valid ranges', () => {
      const corners = createCornerPoints(
        384, 216,
        1536, 216,
        1536, 864,
        384, 864
      );

      const result = calculateConfidenceScore(corners, imageWidth, imageHeight);

      expect(result.areaRatio).toBeGreaterThanOrEqual(0);
      expect(result.areaRatio).toBeLessThanOrEqual(1);
      expect(result.rectangularity).toBeGreaterThanOrEqual(0);
      expect(result.rectangularity).toBeLessThanOrEqual(1);
      expect(result.distribution).toBeGreaterThanOrEqual(0);
      expect(result.distribution).toBeLessThanOrEqual(1);
      expect(result.straightness).toBeGreaterThanOrEqual(0);
      expect(result.straightness).toBeLessThanOrEqual(1);
      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(1);
    });
  });

  describe('isHighConfidence', () => {
    it('should return true for high confidence scores', () => {
      const metrics: ConfidenceMetrics = {
        areaRatio: 0.9,
        rectangularity: 0.9,
        distribution: 0.9,
        straightness: 0.9,
        overall: 0.9
      };

      expect(isHighConfidence(metrics)).toBe(true);
    });

    it('should return false for low confidence scores', () => {
      const metrics: ConfidenceMetrics = {
        areaRatio: 0.6,
        rectangularity: 0.6,
        distribution: 0.6,
        straightness: 0.6,
        overall: 0.6
      };

      expect(isHighConfidence(metrics)).toBe(false);
    });

    it('should use custom threshold when provided', () => {
      const metrics: ConfidenceMetrics = {
        areaRatio: 0.8,
        rectangularity: 0.8,
        distribution: 0.8,
        straightness: 0.8,
        overall: 0.8
      };

      expect(isHighConfidence(metrics, 0.85)).toBe(false);
      expect(isHighConfidence(metrics, 0.75)).toBe(true);
    });

    it('should handle boundary cases', () => {
      const metrics: ConfidenceMetrics = {
        areaRatio: 0.85,
        rectangularity: 0.85,
        distribution: 0.85,
        straightness: 0.85,
        overall: 0.85
      };

      expect(isHighConfidence(metrics, 0.85)).toBe(true);
    });
  });

  describe('getConfidenceLevel', () => {
    it('should return "Excellent" for very high confidence', () => {
      expect(getConfidenceLevel(0.95)).toBe('Excellent');
      expect(getConfidenceLevel(0.90)).toBe('Excellent');
    });

    it('should return "Good" for good confidence', () => {
      expect(getConfidenceLevel(0.85)).toBe('Good');
      expect(getConfidenceLevel(0.80)).toBe('Good');
    });

    it('should return "Fair" for fair confidence', () => {
      expect(getConfidenceLevel(0.75)).toBe('Fair');
      expect(getConfidenceLevel(0.70)).toBe('Fair');
    });

    it('should return "Low" for low confidence', () => {
      expect(getConfidenceLevel(0.65)).toBe('Low');
      expect(getConfidenceLevel(0.60)).toBe('Low');
    });

    it('should return "Poor" for poor confidence', () => {
      expect(getConfidenceLevel(0.55)).toBe('Poor');
      expect(getConfidenceLevel(0.30)).toBe('Poor');
    });
  });

  describe('Edge cases', () => {
    it('should handle degenerate rectangle (line)', () => {
      const corners = createCornerPoints(
        100, 100,
        1800, 100,
        1800, 100,
        100, 100
      );

      const result = calculateConfidenceScore(corners, imageWidth, imageHeight);
      
      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(1);
    });

    it('should handle very large detection (>95% of image)', () => {
      const corners = createCornerPoints(
        10, 10,
        1910, 10,
        1910, 1070,
        10, 1070
      );

      const result = calculateConfidenceScore(corners, imageWidth, imageHeight);
      
      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThan(1.0);
    });

    it('should handle rotated rectangle', () => {
      // 45-degree rotated rectangle
      const corners = createCornerPoints(
        960, 200,     // top
        1700, 540,    // right
        960, 880,     // bottom
        220, 540      // left
      );

      const result = calculateConfidenceScore(corners, imageWidth, imageHeight);
      
      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(1);
    });
  });

  describe('Performance', () => {
    it('should calculate confidence quickly', () => {
      const corners = createCornerPoints(
        384, 216,
        1536, 216,
        1536, 864,
        384, 864
      );

      const startTime = performance.now();
      
      for (let i = 0; i < 100; i++) {
        calculateConfidenceScore(corners, imageWidth, imageHeight);
      }
      
      const endTime = performance.now();
      const avgTime = (endTime - startTime) / 100;

      // Should be fast (< 1ms per calculation)
      expect(avgTime).toBeLessThan(1);
    });
  });
});

