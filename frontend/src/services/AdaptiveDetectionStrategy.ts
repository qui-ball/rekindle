/**
 * Adaptive Detection Strategy
 * 
 * Implements intelligent strategy selection for optimal performance:
 * - Quick single-pass for high-confidence photos (>0.85)
 * - Full multi-pass for challenging photos (<0.85)
 * 
 * Target performance:
 * - Standard photos: <500ms (quick path)
 * - Challenging photos: <1500ms (multi-pass path)
 */

import type { CornerPoints } from '../types/jscanify';
import { MultiPassDetector, type DetectionCandidate, type MultiPassResult } from './MultiPassDetector';
import { calculateConfidenceScore, isHighConfidence, type ConfidenceMetrics } from './ConfidenceScoring';
import { imagePreprocessor } from './ImagePreprocessor';
import { opencvLoader } from './opencvLoader';

export interface AdaptiveDetectionResult {
  cornerPoints: CornerPoints | null;
  confidence: number;
  metrics: ConfidenceMetrics | null;
  method: string;
  reason: string;
  processingTime: number;
  usedMultiPass: boolean;
  candidates?: DetectionCandidate[];
}

export interface AdaptiveDetectionOptions {
  confidenceThreshold: number; // Threshold for quick vs multi-pass (default: 0.85)
  quickTimeoutMs: number;       // Max time for quick detection (default: 500ms)
  multiPassTimeoutMs: number;   // Max time for multi-pass (default: 1500ms)
  enablePreprocessing: boolean; // Use preprocessing in quick pass (default: true)
}

const DEFAULT_OPTIONS: AdaptiveDetectionOptions = {
  confidenceThreshold: 0.85,
  quickTimeoutMs: 500,
  multiPassTimeoutMs: 1500,
  enablePreprocessing: true
};

/**
 * Adaptive detection strategy that chooses between quick and full multi-pass
 */
export class AdaptiveDetectionStrategy {
  private scanner: any = null;
  private options: AdaptiveDetectionOptions;

  constructor(scanner: any, options: Partial<AdaptiveDetectionOptions> = {}) {
    this.scanner = scanner;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Run adaptive detection: quick single-pass first, then multi-pass if needed
   */
  async detect(
    src: any, // OpenCV Mat
    imageWidth: number,
    imageHeight: number
  ): Promise<AdaptiveDetectionResult> {
    const totalStartTime = performance.now();

    console.log('🎯 Starting adaptive detection strategy...');

    // Step 1: Try quick single-pass detection
    const quickResult = await this.quickDetection(src, imageWidth, imageHeight);

    // Check if quick detection was good enough
    if (quickResult.confidence >= this.options.confidenceThreshold) {
      const processingTime = performance.now() - totalStartTime;
      
      console.log(`✅ Quick detection succeeded (${Math.round(quickResult.confidence * 100)}% confidence) in ${Math.round(processingTime)}ms`);
      
      return {
        ...quickResult,
        processingTime,
        usedMultiPass: false
      };
    }

    console.log(`⚡ Quick detection confidence too low (${Math.round(quickResult.confidence * 100)}%), running multi-pass...`);

    // Step 2: Run full multi-pass detection for challenging photos
    const multiPassResult = await this.multiPassDetection(src, imageWidth, imageHeight);

    const processingTime = performance.now() - totalStartTime;

    if (multiPassResult.success && multiPassResult.best) {
      console.log(`✅ Multi-pass detection succeeded (${Math.round(multiPassResult.best.confidence * 100)}% confidence) in ${Math.round(processingTime)}ms`);
      
      return {
        cornerPoints: multiPassResult.best.cornerPoints,
        confidence: multiPassResult.best.confidence,
        metrics: multiPassResult.best.metrics,
        method: multiPassResult.best.method,
        reason: `Multi-pass: ${multiPassResult.best.reason}`,
        processingTime,
        usedMultiPass: true,
        candidates: multiPassResult.candidates
      };
    }

    // Step 3: Fall back to quick result if multi-pass also failed
    console.log(`⚠️ Multi-pass also failed, using best available result`);
    
    return {
      ...quickResult,
      processingTime,
      usedMultiPass: true,
      reason: 'Fallback to quick detection result'
    };
  }

  /**
   * Quick single-pass detection with optional preprocessing
   * Target: <500ms
   */
  private async quickDetection(
    src: any,
    imageWidth: number,
    imageHeight: number
  ): Promise<Omit<AdaptiveDetectionResult, 'processingTime' | 'usedMultiPass'>> {
    const startTime = performance.now();
    let preprocessResult = null;

    try {
      if (!this.scanner) {
        throw new Error('Scanner not initialized');
      }

      // Apply preprocessing if enabled
      let detectionSrc = src;
      if (this.options.enablePreprocessing) {
        try {
          const options = imagePreprocessor.analyzeImage(src);
          preprocessResult = imagePreprocessor.preprocessForDetection(src, options);
          detectionSrc = preprocessResult.preprocessed;
          console.log('✅ Quick detection using preprocessing');
        } catch (error) {
          console.warn('⚠️ Preprocessing failed in quick detection:', error);
          detectionSrc = src;
        }
      }

      // Run JScanify detection
      const contour = this.scanner.findPaperContour(detectionSrc);
      
      if (!contour) {
        throw new Error('No contour found');
      }

      let cornerPoints = this.scanner.getCornerPoints(contour) as CornerPoints | null;
      
      if (!cornerPoints) {
        throw new Error('No corner points found');
      }

      // Refine with Shi-Tomasi on original image
      cornerPoints = this.refineCornerPoints(src, cornerPoints);

      // Calculate confidence
      const metrics = calculateConfidenceScore(cornerPoints, imageWidth, imageHeight);

      // Cleanup preprocessing
      if (preprocessResult) {
        imagePreprocessor.cleanup(preprocessResult);
      }

      const processingTime = performance.now() - startTime;

      return {
        cornerPoints,
        confidence: metrics.overall,
        metrics,
        method: this.options.enablePreprocessing ? 'jscanify-enhanced' : 'jscanify-standard',
        reason: 'Quick single-pass detection',
        candidates: undefined
      };
    } catch (error) {
      console.warn('⚠️ Quick detection failed:', error);
      
      // Cleanup on error
      if (preprocessResult) {
        imagePreprocessor.cleanup(preprocessResult);
      }

      // Return low-confidence result
      return {
        cornerPoints: null,
        confidence: 0.0,
        metrics: null,
        method: 'quick-failed',
        reason: `Quick detection failed: ${error}`,
        candidates: undefined
      };
    }
  }

  /**
   * Full multi-pass detection with all strategies
   * Target: <1500ms
   */
  private async multiPassDetection(
    src: any,
    imageWidth: number,
    imageHeight: number
  ): Promise<MultiPassResult> {
    const detector = new MultiPassDetector(this.scanner);
    return detector.detectMultiPass(src, imageWidth, imageHeight);
  }

  /**
   * Refine corner points using Shi-Tomasi
   */
  private refineCornerPoints(src: any, cornerPoints: CornerPoints): CornerPoints {
    const cv = opencvLoader.getOpenCV();
    // Check if cornerSubPix is available in this OpenCV.js build
    if (!cv.cornerSubPix) {
      console.log('ℹ️ cornerSubPix not available in OpenCV.js build, skipping refinement');
      return cornerPoints;
    }

    const gray = new cv.Mat();
    let corners: any = null;
    
    try {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
      
      // Convert corner points to OpenCV format
      corners = new cv.Mat(4, 1, cv.CV_32FC2);
      corners.data32F[0] = cornerPoints.topLeftCorner.x;
      corners.data32F[1] = cornerPoints.topLeftCorner.y;
      corners.data32F[2] = cornerPoints.topRightCorner.x;
      corners.data32F[3] = cornerPoints.topRightCorner.y;
      corners.data32F[4] = cornerPoints.bottomRightCorner.x;
      corners.data32F[5] = cornerPoints.bottomRightCorner.y;
      corners.data32F[6] = cornerPoints.bottomLeftCorner.x;
      corners.data32F[7] = cornerPoints.bottomLeftCorner.y;
      
      // Use cornerSubPix for sub-pixel accuracy
      const winSize = new cv.Size(5, 5);
      const zeroZone = new cv.Size(-1, -1);
      const criteria = new cv.TermCriteria(cv.TERM_CRITERIA_EPS + cv.TERM_CRITERIA_MAX_ITER, 30, 0.1);
      cv.cornerSubPix(gray, corners, winSize, zeroZone, criteria);
      
      // Extract refined points
      const refined: CornerPoints = {
        topLeftCorner: { x: corners.data32F[0], y: corners.data32F[1] },
        topRightCorner: { x: corners.data32F[2], y: corners.data32F[3] },
        bottomRightCorner: { x: corners.data32F[4], y: corners.data32F[5] },
        bottomLeftCorner: { x: corners.data32F[6], y: corners.data32F[7] }
      };
      
      // Clean up
      gray.delete();
      corners.delete();
      
      return refined;
    } catch (error) {
      console.warn('⚠️ Shi-Tomasi refinement failed:', error);
      if (gray && !gray.isDeleted?.()) gray.delete();
      if (corners && !corners.isDeleted?.()) corners.delete();
      return cornerPoints;
    }
  }

  /**
   * Update strategy options
   */
  updateOptions(options: Partial<AdaptiveDetectionOptions>): void {
    this.options = { ...this.options, ...options };
    console.log('📊 Updated adaptive detection options:', this.options);
  }

  /**
   * Get current strategy configuration
   */
  getOptions(): AdaptiveDetectionOptions {
    return { ...this.options };
  }
}

