/**
 * GuideContentDetector Service
 * 
 * Provides real-time computer vision detection within corner guide boundaries
 * to detect rectangular objects and determine which orientation guide is active.
 * 
 * Features:
 * - Real-time detection within each guide's 4 corners using OpenCV.js
 * - Smart hiding logic: when one guide detects content, hide the other guide
 * - Detection state management with confidence scoring
 * - Integration with existing JScanify detection system
 * - Performance optimization for real-time camera feed analysis
 */

import { jscanifyService } from './jscanifyService';

interface JScanifyDetectionInput {
  detected: boolean;
  confidence: number;
  cornerPoints?: {
    topLeftCorner: { x: number; y: number };
    topRightCorner: { x: number; y: number };
    bottomLeftCorner: { x: number; y: number };
    bottomRightCorner: { x: number; y: number };
  };
  cropArea?: { x: number; y: number; width: number; height: number };
  metrics?: {
    areaRatio: number;
    edgeRatio: number;
    minDistance: number;
  };
}

type CornerPointsUnion = CornerPoints | JScanifyDetectionInput['cornerPoints'];

export interface CornerPoint {
  x: number;
  y: number;
}

export interface CornerPoints {
  topLeft: CornerPoint;
  topRight: CornerPoint;
  bottomLeft: CornerPoint;
  bottomRight: CornerPoint;
}

export interface GuideDetectionResult {
  orientation: 'portrait' | 'landscape' | null;
  confidence: number;
  detectedCorners: CornerPoints | null;
  isDetected: boolean;
  detectionSource: 'jscanify' | 'fallback' | 'none';
  metrics: {
    areaRatio: number;
    edgeRatio: number;
    minDistance: number;
    processingTime: number;
  };
}

export interface GuideDetectionState {
  portrait: {
    isDetected: boolean;
    confidence: number;
    lastDetection: number;
  };
  landscape: {
    isDetected: boolean;
    confidence: number;
    lastDetection: number;
  };
  activeOrientation: 'portrait' | 'landscape' | null;
  lastUpdate: number;
}

export class GuideContentDetector {
  private detectionState: GuideDetectionState;
  private isInitialized: boolean = false;
  private detectionInterval: number | null = null;
  private readonly DETECTION_INTERVAL = 100; // 100ms for real-time detection
  private readonly CONFIDENCE_THRESHOLD = 0.6;
  private readonly DETECTION_TIMEOUT = 2000; // 2 seconds timeout for detection

  constructor() {
    this.detectionState = {
      portrait: { isDetected: false, confidence: 0, lastDetection: 0 },
      landscape: { isDetected: false, confidence: 0, lastDetection: 0 },
      activeOrientation: null,
      lastUpdate: Date.now()
    };
  }

  /**
   * Initialize the detector with OpenCV.js
   */
  async initialize(): Promise<boolean> {
    try {
      // Initialize JScanify service for detection
      await jscanifyService.initialize();
      this.isInitialized = true;
      console.log('✅ GuideContentDetector initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize GuideContentDetector:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Start real-time detection for a specific camera feed
   * @param videoElement - HTML video element from camera
   * @param portraitCorners - Portrait guide corner positions
   * @param landscapeCorners - Landscape guide corner positions
   * @param onDetection - Callback for detection results
   */
  startRealTimeDetection(
    videoElement: HTMLVideoElement,
    portraitCorners: CornerPoints,
    landscapeCorners: CornerPoints,
    onDetection: (result: GuideDetectionResult) => void
  ): void {
    // Initialize if not already done (non-blocking)
    if (!this.isInitialized) {
      this.initialize().catch(error => {
        console.error('❌ Background initialization failed:', error);
      });
    }

    // Clear any existing detection interval
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
    }

    // Start real-time detection
    this.detectionInterval = window.setInterval(async () => {
      try {
        // Skip detection if not yet initialized
        if (!this.isInitialized) {
          return;
        }
        
        const result = await this.detectContentInGuides(
          videoElement,
          portraitCorners,
          landscapeCorners
        );
        onDetection(result);
      } catch (error) {
        console.error('❌ Real-time detection error:', error);
      }
    }, this.DETECTION_INTERVAL);
  }

  /**
   * Stop real-time detection
   */
  stopRealTimeDetection(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
  }

  /**
   * Detect content within guide boundaries
   * @param videoElement - Camera video element
   * @param portraitCorners - Portrait guide corners
   * @param landscapeCorners - Landscape guide corners
   * @returns Detection result with orientation and confidence
   */
  async detectContentInGuides(
    videoElement: HTMLVideoElement,
    _portraitCorners: CornerPoints,
    _landscapeCorners: CornerPoints
  ): Promise<GuideDetectionResult> {
    const startTime = performance.now();

    try {
      // Create canvas to capture current video frame
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // Set canvas dimensions to match video
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;

      // Draw current video frame to canvas
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      // Convert canvas to image data
      const imageData = canvas.toDataURL('image/jpeg', 0.8);

      // Use JScanify to detect photo boundaries in the full image
      const detectionResult = await jscanifyService.detectPhotoBoundaries(
        imageData,
        canvas.width,
        canvas.height
      );

      // Analyze the shape of the detected object to determine orientation
      const orientationResult = this.analyzeObjectOrientation(detectionResult);

      // Update detection state based on orientation
      this.updateDetectionStateFromOrientation(orientationResult);

      const processingTime = performance.now() - startTime;

      return {
        orientation: orientationResult.orientation,
        confidence: orientationResult.confidence,
        detectedCorners: orientationResult.detectedCorners,
        isDetected: orientationResult.isDetected,
        detectionSource: orientationResult.detectionSource,
        metrics: {
          areaRatio: orientationResult.metrics.areaRatio,
          edgeRatio: orientationResult.metrics.edgeRatio,
          minDistance: orientationResult.metrics.minDistance,
          processingTime
        }
      };

    } catch (error) {
      console.error('❌ Guide content detection error:', error);
      return this.getFallbackResult();
    }
  }

  /**
   * Detect content within a specific guide's boundaries
   * @param imageData - Base64 image data
   * @param corners - Guide corner positions
   * @param orientation - Guide orientation
   * @returns Detection result for this guide
   */
  /**
   * Analyze the shape of the detected object to determine its orientation
   * @param detectionResult - JScanify detection result
   * @returns Detection result with orientation based on object shape
   */
  private analyzeObjectOrientation(detectionResult: JScanifyDetectionInput): GuideDetectionResult {
    if (!detectionResult.detected || !detectionResult.cornerPoints) {
      return {
        orientation: null,
        confidence: 0,
        detectedCorners: null,
        isDetected: false,
        detectionSource: 'none',
        metrics: {
          areaRatio: 0,
          edgeRatio: 0,
          minDistance: 0,
          processingTime: 0
        }
      };
    }

    // Calculate the aspect ratio of the detected object
    const aspectRatio = this.calculateAspectRatio(detectionResult.cornerPoints);
    
    // Determine orientation based on aspect ratio
    let orientation: 'portrait' | 'landscape' | null = null;
    let confidence = detectionResult.confidence;
    
    if (aspectRatio > 1.2) {
      // Wide object - landscape orientation
      orientation = 'landscape';
    } else if (aspectRatio < 0.8) {
      // Tall object - portrait orientation  
      orientation = 'portrait';
    } else {
      // Square-ish object - use confidence to determine
      if (detectionResult.confidence > 0.7) {
        // High confidence - assume landscape for square objects
        orientation = 'landscape';
      } else {
        // Low confidence - no clear orientation
        orientation = null;
        confidence = 0;
      }
    }

    // Convert corner points format from JScanify to CornerPoints
    const convertedCorners: CornerPoints | null = detectionResult.cornerPoints ? {
      topLeft: detectionResult.cornerPoints.topLeftCorner,
      topRight: detectionResult.cornerPoints.topRightCorner,
      bottomLeft: detectionResult.cornerPoints.bottomLeftCorner,
      bottomRight: detectionResult.cornerPoints.bottomRightCorner
    } : null;

    return {
      orientation,
      confidence,
      detectedCorners: convertedCorners,
      isDetected: orientation !== null,
      detectionSource: 'jscanify',
      metrics: {
        areaRatio: aspectRatio,
        edgeRatio: 0.8,
        minDistance: 10,
        processingTime: 0
      }
    };
  }

  /**
   * Calculate aspect ratio of detected object
   * @param cornerPoints - Detected corner points
   * @returns Aspect ratio (width/height)
   */
  private calculateAspectRatio(cornerPoints: JScanifyDetectionInput['cornerPoints']): number {
    if (!cornerPoints || !cornerPoints.topLeftCorner || !cornerPoints.topRightCorner || 
        !cornerPoints.bottomLeftCorner || !cornerPoints.bottomRightCorner) {
      return 1;
    }

    const { topLeftCorner, topRightCorner, bottomLeftCorner } = cornerPoints;
    
    // Calculate width and height
    const width = Math.abs(topRightCorner.x - topLeftCorner.x);
    const height = Math.abs(bottomLeftCorner.y - topLeftCorner.y);
    
    if (height === 0) return 1;
    
    return width / height;
  }

  /**
   * Analyze how well detected boundaries match a specific guide area
   * @param detectionResult - JScanify detection result
   * @param guideCorners - Guide corner positions
   * @param orientation - Guide orientation
   * @returns Detection result for this guide
   */
  private analyzeGuideMatch(
    detectionResult: JScanifyDetectionInput,
    guideCorners: CornerPoints,
    orientation: 'portrait' | 'landscape'
  ): GuideDetectionResult {
    if (!detectionResult.detected || !detectionResult.cornerPoints) {
      return {
        orientation,
        confidence: 0,
        detectedCorners: null,
        isDetected: false,
        detectionSource: 'none',
        metrics: {
          areaRatio: 0,
          edgeRatio: 0,
          minDistance: 0,
          processingTime: 0
        }
      };
    }

    // Calculate how well the detected boundaries match the guide area
    const matchScore = this.calculateGuideMatch(detectionResult.cornerPoints, guideCorners);
    
    
    if (matchScore > this.CONFIDENCE_THRESHOLD) {
      // Convert corner points format from JScanify to CornerPoints
      const convertedCorners: CornerPoints | null = detectionResult.cornerPoints ? {
        topLeft: detectionResult.cornerPoints.topLeftCorner,
        topRight: detectionResult.cornerPoints.topRightCorner,
        bottomLeft: detectionResult.cornerPoints.bottomLeftCorner,
        bottomRight: detectionResult.cornerPoints.bottomRightCorner
      } : null;

      return {
        orientation,
        confidence: matchScore,
        detectedCorners: convertedCorners,
        isDetected: true,
        detectionSource: 'jscanify',
        metrics: {
          areaRatio: matchScore,
          edgeRatio: 0.8,
          minDistance: 10,
          processingTime: 0
        }
      };
    }

    return {
      orientation,
      confidence: matchScore,
      detectedCorners: null,
      isDetected: false,
      detectionSource: 'jscanify',
      metrics: {
        areaRatio: matchScore,
        edgeRatio: 0,
        minDistance: 0,
        processingTime: 0
      }
    };
  }

  /**
   * Calculate how well detected corners match guide corners
   * @param detectedCorners - Detected corner points
   * @param guideCorners - Guide corner points
   * @returns Match score between 0 and 1
   */
  private calculateGuideMatch(detectedCorners: JScanifyDetectionInput['cornerPoints'], guideCorners: CornerPoints): number {
    if (!detectedCorners) return 0;

    // Calculate the overlap between detected area and guide area
    const detectedArea = this.calculateQuadrilateralArea(detectedCorners);
    const guideArea = this.calculateQuadrilateralArea(guideCorners);
    
    if (guideArea === 0) return 0;

    // Calculate intersection area (simplified - assumes rectangular overlap)
    const intersectionArea = this.calculateIntersectionArea(detectedCorners, guideCorners);
    
    // Calculate match score based on overlap ratio
    const overlapRatio = intersectionArea / Math.max(detectedArea, guideArea);
    
    return Math.min(1, overlapRatio);
  }

  /**
   * Calculate area of a quadrilateral
   * @param corners - Corner points
   * @returns Area of the quadrilateral
   */
  private calculateQuadrilateralArea(corners: CornerPointsUnion): number {
    if (!corners) return 0;
    
    // Handle both detected corners (with Corner suffix) and guide corners (without suffix)
    let topLeft, topRight, bottomLeft, bottomRight;
    
    if ('topLeftCorner' in corners && corners.topLeftCorner) {
      // Detected corners format
      topLeft = corners.topLeftCorner;
      topRight = corners.topRightCorner;
      bottomLeft = corners.bottomLeftCorner;
      bottomRight = corners.bottomRightCorner;
    } else if ('topLeft' in corners && corners.topLeft) {
      // Guide corners format
      topLeft = corners.topLeft;
      topRight = corners.topRight;
      bottomLeft = corners.bottomLeft;
      bottomRight = corners.bottomRight;
    } else {
      return 0;
    }
    
    if (!topLeft || !topRight || !bottomLeft || !bottomRight) {
      return 0;
    }
    
    // Use shoelace formula for polygon area
    const x1 = topLeft.x, y1 = topLeft.y;
    const x2 = topRight.x, y2 = topRight.y;
    const x3 = bottomRight.x, y3 = bottomRight.y;
    const x4 = bottomLeft.x, y4 = bottomLeft.y;
    
    return Math.abs((x1*y2 + x2*y3 + x3*y4 + x4*y1) - (y1*x2 + y2*x3 + y3*x4 + y4*x1)) / 2;
  }

  /**
   * Calculate intersection area between detected and guide areas
   * @param detectedCorners - Detected corner points
   * @param guideCorners - Guide corner points
   * @returns Intersection area
   */
  private calculateIntersectionArea(detectedCorners: JScanifyDetectionInput['cornerPoints'], guideCorners: CornerPoints): number {
    // Simplified intersection calculation - assumes rectangular overlap
    const detectedBounds = this.getBounds(detectedCorners);
    const guideBounds = this.getBounds(guideCorners);
    
    const left = Math.max(detectedBounds.left, guideBounds.left);
    const right = Math.min(detectedBounds.right, guideBounds.right);
    const top = Math.max(detectedBounds.top, guideBounds.top);
    const bottom = Math.min(detectedBounds.bottom, guideBounds.bottom);
    
    if (left < right && top < bottom) {
      return (right - left) * (bottom - top);
    }
    
    return 0;
  }

  /**
   * Get bounding box for corner points
   * @param corners - Corner points
   * @returns Bounding box
   */
  private getBounds(corners: CornerPointsUnion): { left: number, right: number, top: number, bottom: number } {
    if (!corners) return { left: 0, right: 0, top: 0, bottom: 0 };
    
    // Handle both detected corners (with Corner suffix) and guide corners (without suffix)
    let topLeft, topRight, bottomLeft, bottomRight;
    
    if ('topLeftCorner' in corners && corners.topLeftCorner) {
      // Detected corners format
      topLeft = corners.topLeftCorner;
      topRight = corners.topRightCorner;
      bottomLeft = corners.bottomLeftCorner;
      bottomRight = corners.bottomRightCorner;
    } else if ('topLeft' in corners && corners.topLeft) {
      // Guide corners format
      topLeft = corners.topLeft;
      topRight = corners.topRight;
      bottomLeft = corners.bottomLeft;
      bottomRight = corners.bottomRight;
    } else {
      return { left: 0, right: 0, top: 0, bottom: 0 };
    }
    
    if (!topLeft || !topRight || !bottomLeft || !bottomRight) {
      return { left: 0, right: 0, top: 0, bottom: 0 };
    }
    
    return {
      left: Math.min(topLeft.x, bottomLeft.x),
      right: Math.max(topRight.x, bottomRight.x),
      top: Math.min(topLeft.y, topRight.y),
      bottom: Math.max(bottomLeft.y, bottomRight.y)
    };
  }

  /**
   * Select the best detection result between portrait and landscape
   * @param portraitResult - Portrait detection result
   * @param landscapeResult - Landscape detection result
   * @returns Best detection result
   */
  private selectBestDetection(
    portraitResult: GuideDetectionResult,
    landscapeResult: GuideDetectionResult
  ): GuideDetectionResult {
    // If only one orientation is detected, return it
    if (portraitResult.isDetected && !landscapeResult.isDetected) {
      return portraitResult;
    }
    if (landscapeResult.isDetected && !portraitResult.isDetected) {
      return landscapeResult;
    }

    // If both are detected, choose the one with higher confidence
    if (portraitResult.isDetected && landscapeResult.isDetected) {
      return portraitResult.confidence > landscapeResult.confidence ? portraitResult : landscapeResult;
    }

    // If neither is detected, return a fallback result with null orientation
    return {
      orientation: null,
      confidence: 0,
      detectedCorners: null,
      isDetected: false,
      detectionSource: 'none',
      metrics: {
        areaRatio: 0,
        edgeRatio: 0,
        minDistance: 0,
        processingTime: 0
      }
    };
  }

  /**
   * Update detection state based on object orientation
   * @param orientationResult - Detection result with orientation
   */
  private updateDetectionStateFromOrientation(orientationResult: GuideDetectionResult): void {
    const now = Date.now();

    if (orientationResult.orientation === 'portrait') {
      // Portrait object detected
      this.detectionState.portrait = {
        isDetected: true,
        confidence: orientationResult.confidence,
        lastDetection: now
      };
      this.detectionState.landscape = {
        isDetected: false,
        confidence: 0,
        lastDetection: now
      };
      this.detectionState.activeOrientation = 'portrait';
    } else if (orientationResult.orientation === 'landscape') {
      // Landscape object detected
      this.detectionState.portrait = {
        isDetected: false,
        confidence: 0,
        lastDetection: now
      };
      this.detectionState.landscape = {
        isDetected: true,
        confidence: orientationResult.confidence,
        lastDetection: now
      };
      this.detectionState.activeOrientation = 'landscape';
    } else {
      // No object detected
      this.detectionState.portrait = {
        isDetected: false,
        confidence: 0,
        lastDetection: now
      };
      this.detectionState.landscape = {
        isDetected: false,
        confidence: 0,
        lastDetection: now
      };
      this.detectionState.activeOrientation = null;
    }

    this.detectionState.lastUpdate = now;
  }

  /**
   * Update detection state for both orientations
   * @param portraitResult - Portrait detection result
   * @param landscapeResult - Landscape detection result
   */
  private updateDetectionStateForBoth(portraitResult: GuideDetectionResult, landscapeResult: GuideDetectionResult): void {
    const now = Date.now();

    // Update portrait state
    this.detectionState.portrait = {
      isDetected: portraitResult.isDetected,
      confidence: portraitResult.confidence,
      lastDetection: now
    };

    // Update landscape state
    this.detectionState.landscape = {
      isDetected: landscapeResult.isDetected,
      confidence: landscapeResult.confidence,
      lastDetection: now
    };

    // Determine active orientation based on which has better detection
    if (portraitResult.isDetected && landscapeResult.isDetected) {
      // Both detected - choose the one with higher confidence
      this.detectionState.activeOrientation = portraitResult.confidence > landscapeResult.confidence ? 'portrait' : 'landscape';
    } else if (portraitResult.isDetected) {
      // Only portrait detected
      this.detectionState.activeOrientation = 'portrait';
    } else if (landscapeResult.isDetected) {
      // Only landscape detected
      this.detectionState.activeOrientation = 'landscape';
    } else {
      // Neither detected - clear active orientation
      this.detectionState.activeOrientation = null;
    }

    this.detectionState.lastUpdate = now;
  }

  /**
   * Update detection state based on new results
   * @param result - Latest detection result
   */
  private updateDetectionState(result: GuideDetectionResult): void {
    const now = Date.now();

    if (result.orientation === 'portrait') {
      this.detectionState.portrait = {
        isDetected: result.isDetected,
        confidence: result.confidence,
        lastDetection: now
      };
    } else if (result.orientation === 'landscape') {
      this.detectionState.landscape = {
        isDetected: result.isDetected,
        confidence: result.confidence,
        lastDetection: now
      };
    }

    // Update active orientation based on detection results
    if (result.isDetected && result.orientation) {
      this.detectionState.activeOrientation = result.orientation;
    } else {
      // Check if we should clear active orientation due to timeout
      const timeSinceLastDetection = now - Math.max(
        this.detectionState.portrait.lastDetection,
        this.detectionState.landscape.lastDetection
      );
      
      if (timeSinceLastDetection > this.DETECTION_TIMEOUT) {
        this.detectionState.activeOrientation = null;
      }
    }

    // Clear active orientation if neither orientation is detected
    if (!this.detectionState.portrait.isDetected && !this.detectionState.landscape.isDetected) {
      this.detectionState.activeOrientation = null;
    }

    this.detectionState.lastUpdate = now;
  }

  /**
   * Get current detection state
   * @returns Current detection state
   */
  getDetectionState(): GuideDetectionState {
    // Check for timeout before returning state
    this.checkForTimeout();
    return { ...this.detectionState };
  }

  /**
   * Check if active orientation should be cleared due to timeout
   */
  private checkForTimeout(): void {
    if (this.detectionState.activeOrientation) {
      const now = Date.now();
      const timeSinceLastDetection = now - Math.max(
        this.detectionState.portrait.lastDetection,
        this.detectionState.landscape.lastDetection
      );
      
      if (timeSinceLastDetection > this.DETECTION_TIMEOUT) {
        this.detectionState.activeOrientation = null;
      }
    }
  }

  /**
   * Check if a specific orientation should be hidden
   * @param orientation - Orientation to check
   * @returns True if the orientation should be hidden
   */
  shouldHideGuide(orientation: 'portrait' | 'landscape'): boolean {
    const { activeOrientation } = this.detectionState;
    
    // If no orientation is active, show both guides
    if (!activeOrientation) {
      return false;
    }
    
    // Hide the guide if the other orientation is active and detected
    if (activeOrientation && activeOrientation !== orientation) {
      const otherGuide = activeOrientation === 'portrait' ? this.detectionState.portrait : this.detectionState.landscape;
      // Hide if the other orientation is detected with sufficient confidence
      if (otherGuide.isDetected && otherGuide.confidence > 0.6) {
        return true;
      }
    }

    return false;
  }


  /**
   * Get fallback result when detection fails
   * @returns Fallback detection result
   */
  private getFallbackResult(): GuideDetectionResult {
    return {
      orientation: null,
      confidence: 0,
      detectedCorners: null,
      isDetected: false,
      detectionSource: 'none',
      metrics: {
        areaRatio: 0,
        edgeRatio: 0,
        minDistance: 0,
        processingTime: 0
      }
    };
  }

  /**
   * Check if the detector is ready
   * @returns True if initialized and ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopRealTimeDetection();
    this.isInitialized = false;
  }
}

// Export singleton instance
export const guideContentDetector = new GuideContentDetector();
