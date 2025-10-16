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

// import * as cv from 'opencv.js'; // Not available in this build
import type { CornerPoints } from '../types/jscanify';
import { MultiPassDetector, type DetectionCandidate, type MultiPassResult } from './MultiPassDetector';
import { calculateConfidenceScore, type ConfidenceMetrics } from './ConfidenceScoring';
import { imagePreprocessor } from './ImagePreprocessor';

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
  excellentThreshold: number;   // Threshold for immediate return (default: 0.90)
  goodThreshold: number;         // Threshold for validation (default: 0.85)
  quickTimeoutMs: number;        // Max time for quick detection (default: 500ms)
  validationTimeoutMs: number;   // Max time for validation (default: 800ms)
  multiPassTimeoutMs: number;    // Max time for multi-pass (default: 1500ms)
  enablePreprocessing: boolean;  // Use preprocessing in quick pass (default: true)
  alwaysUseMultiPass: boolean;   // Force full multi-pass every time (default: false)
}

const DEFAULT_OPTIONS: AdaptiveDetectionOptions = {
  excellentThreshold: 0.90,  // 90%+ = Excellent, return immediately
  goodThreshold: 0.85,       // 85-90% = Good, validate with one strategy
  quickTimeoutMs: 500,
  validationTimeoutMs: 800,
  multiPassTimeoutMs: 1500,
  enablePreprocessing: true,
  alwaysUseMultiPass: false  // For testing: set to true to always use full multi-pass
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
   * Run adaptive detection with smart hybrid approach:
   * - Excellent (≥90%): Return immediately
   * - Good (85-90%): Validate with one complementary strategy
   * - Fair/Poor (<85%): Run full multi-pass
   * - alwaysUseMultiPass: Skip to full multi-pass immediately
   */
  async detect(
    src: any, // OpenCV Mat
    imageWidth: number,
    imageHeight: number
  ): Promise<AdaptiveDetectionResult> {
    const totalStartTime = performance.now();

    // Testing mode: Always use full multi-pass
    if (this.options.alwaysUseMultiPass) {
      console.log('🔬 TEST MODE: Running full multi-pass detection (alwaysUseMultiPass=true)...');
      
      const multiPassResult = await this.multiPassDetection(src, imageWidth, imageHeight);
      const processingTime = performance.now() - totalStartTime;

      if (multiPassResult.success && multiPassResult.best) {
        console.log(`✅ Multi-pass detection completed: ${Math.round(multiPassResult.best.confidence * 100)}% in ${Math.round(processingTime)}ms`);
        
        return {
          cornerPoints: multiPassResult.best.cornerPoints,
          confidence: multiPassResult.best.confidence,
          metrics: multiPassResult.best.metrics,
          method: multiPassResult.best.method,
          reason: `Test mode: ${multiPassResult.best.reason}`,
          processingTime,
          usedMultiPass: true,
          candidates: multiPassResult.candidates
        };
      }

      // Fallback if multi-pass fails
      console.log(`⚠️ Multi-pass failed in test mode`);
      return {
        cornerPoints: null as any,
        confidence: 0,
        metrics: { overall: 0, areaRatio: 0, rectangularity: 0, distribution: 0, straightness: 0 },
        method: 'multi-pass-failed',
        reason: 'Multi-pass detection failed',
        processingTime,
        usedMultiPass: true,
        candidates: []
      };
    }

    console.log('🎯 Starting smart hybrid detection strategy...');

    // Step 1: Try quick single-pass detection
    const quickResult = await this.quickDetection(src, imageWidth, imageHeight);
    const quickConfidence = quickResult.confidence;

    // Path 1: Excellent (≥90%) - Return immediately
    if (quickConfidence >= this.options.excellentThreshold) {
      const processingTime = performance.now() - totalStartTime;
      
      console.log(`✨ EXCELLENT detection (${Math.round(quickConfidence * 100)}%) - returning immediately in ${Math.round(processingTime)}ms`);
      
      return {
        ...quickResult,
        processingTime,
        usedMultiPass: false,
        reason: quickResult.reason + ' [Excellent confidence, no validation needed]'
      };
    }

    // Path 2: Good (85-90%) - Validate with one complementary strategy
    if (quickConfidence >= this.options.goodThreshold) {
      console.log(`✓ GOOD detection (${Math.round(quickConfidence * 100)}%) - validating with complementary strategy...`);
      
      const validationResult = await this.runComplementaryValidation(src, imageWidth, imageHeight);
      const processingTime = performance.now() - totalStartTime;

      // Compare quick vs validation result
      if (validationResult && validationResult.confidence > quickConfidence) {
        const improvement = Math.round((validationResult.confidence - quickConfidence) * 100);
        console.log(`📈 Validation found better result: ${Math.round(validationResult.confidence * 100)}% (+${improvement}%) in ${Math.round(processingTime)}ms`);
        
        return {
          cornerPoints: validationResult.cornerPoints,
          confidence: validationResult.confidence,
          metrics: validationResult.metrics,
          method: validationResult.method,
          reason: `Validation improved: ${validationResult.reason}`,
          processingTime,
          usedMultiPass: false,
          candidates: [validationResult]
        };
      }

      console.log(`✓ Quick detection was best: ${Math.round(quickConfidence * 100)}% in ${Math.round(processingTime)}ms`);
      return {
        ...quickResult,
        processingTime,
        usedMultiPass: false,
        reason: quickResult.reason + ' [Validated with complementary strategy]'
      };
    }

    // Path 3: Fair/Poor (<85%) - Run full multi-pass
    console.log(`⚡ LOW confidence (${Math.round(quickConfidence * 100)}%) - running full multi-pass detection...`);

    const multiPassResult = await this.multiPassDetection(src, imageWidth, imageHeight);
    const processingTime = performance.now() - totalStartTime;

    if (multiPassResult.success && multiPassResult.best) {
      const improvement = Math.round((multiPassResult.best.confidence - quickConfidence) * 100);
      console.log(`✅ Multi-pass found better result: ${Math.round(multiPassResult.best.confidence * 100)}% (+${improvement}%) in ${Math.round(processingTime)}ms`);
      
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

    // Fallback: Use quick result if multi-pass also failed
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
   * Run a single complementary validation strategy
   * Uses contour detection as it's different from enhanced JScanify
   * Target: <800ms
   */
  private async runComplementaryValidation(
    src: any,
    imageWidth: number,
    imageHeight: number
  ): Promise<DetectionCandidate | null> {
    // Use MultiPassDetector's contour detection as the complementary strategy
    const detector = new MultiPassDetector(this.scanner);
    
    try {
      // Run contour detection (different approach from JScanify)
      const result = await detector['contourDetection'](src, imageWidth, imageHeight);
      
      if (result && result.cornerPoints) {
        console.log(`   → Contour validation: ${Math.round(result.confidence * 100)}%`);
        return result;
      }
    } catch (error) {
      console.warn('⚠️ Complementary validation failed:', error);
    }
    
    return null;
  }

  /**
   * Refine corner points using Shi-Tomasi
   */
  private refineCornerPoints(src: any, cornerPoints: CornerPoints): CornerPoints {
    // Corner refinement not available in this build
    // Return original points without modification
    console.log('ℹ️ Corner refinement not available, using original points');
    return cornerPoints;
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

