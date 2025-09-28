// JScanify service for smart photo detection and cropping

import type { CornerPoints } from '../types/jscanify';
import { opencvLoader } from './opencvLoader';

export interface DetectionResult {
  detected: boolean;
  cropArea: CropAreaPixels;
  confidence: number;
  cornerPoints?: CornerPoints;
}

export interface CropAreaPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

// JScanify interface for type safety
interface JScanifyInstance {
  findPaperContour(image: unknown): unknown;
  getCornerPoints(contour: unknown): unknown;
  extractPaper(image: unknown, cornerPoints: unknown, maxWidth?: number, maxHeight?: number): unknown;
}

// JScanify constructor interface
interface JScanifyConstructor {
  new (): JScanifyInstance;
}

export class JScanifyService {
  private scanner: JScanifyInstance | null = null;
  private isReady: boolean = false;

  constructor() {
    // Scanner will be initialized after OpenCV.js loads
  }

  /**
   * Initialize JScanify after OpenCV.js is loaded
   */
  async initialize(): Promise<boolean> {
    try {
      // Only initialize in browser environment
      if (typeof window === 'undefined') {
        throw new Error('JScanify can only be used in browser environment');
      }

      // Ensure OpenCV.js is loaded first
      if (!opencvLoader.isReady()) {
        await opencvLoader.loadOpenCV();
      }

      // Check if OpenCV is available
      if (!window.cv || !window.cv.Mat) {
        throw new Error('OpenCV.js not available');
      }

      // Try to load JScanify dynamically at runtime
      try {
        // Use dynamic import with error handling
        const JScanifyClass = await this.loadJScanify();
        if (JScanifyClass) {
          this.scanner = new JScanifyClass();
          this.isReady = true;
          console.log('✅ JScanify initialized successfully');
          return true;
        }
      } catch {
        // JScanify loading failed
        console.log('📋 JScanify not available, using fallback detection');
      }

      // JScanify not available - using fallback mode
      this.isReady = false;
      console.log('📋 Photo detection will use generic crop areas');
      return false;
    } catch (error) {
      console.warn('⚠️ JScanify initialization failed:', error);
      this.isReady = false;
      return false;
    }
  }

  /**
   * Dynamically load JScanify browser version at runtime
   */
  private async loadJScanify(): Promise<JScanifyConstructor | null> {
    // This will only be called at runtime in the browser
    if (typeof window !== 'undefined') {
      try {
        // Check if JScanify is already loaded
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).jscanify) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (window as any).jscanify;
        }

        // Load JScanify browser version from public directory
        return new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = '/jscanify.js';
          script.onload = () => {
            // JScanify should be available as a global
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((window as any).jscanify) {
              console.log('✅ JScanify browser version loaded successfully');
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              resolve((window as any).jscanify);
            } else {
              console.warn('⚠️ JScanify loaded but not found in global scope');
              resolve(null);
            }
          };
          script.onerror = (error) => {
            console.warn('⚠️ Failed to load JScanify browser version:', error);
            resolve(null);
          };
          document.head.appendChild(script);
        });
      } catch (error) {
        console.warn('⚠️ Error loading JScanify:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Detect photo boundaries using JScanify
   */
  async detectPhotoBoundaries(
    imageData: string,
    imageWidth: number,
    imageHeight: number
  ): Promise<DetectionResult> {
    if (!this.isReady || !this.scanner) {
      console.log('📋 JScanify not ready, using fallback crop area');
      return this.getFallbackCropArea(imageWidth, imageHeight);
    }

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      return new Promise((resolve) => {
        img.onload = () => {
          try {
            // Create canvas to get image data
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              throw new Error('Could not get canvas context');
            }

            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            // Convert to OpenCV Mat
            const cv = opencvLoader.getOpenCV();
            const src = cv.imread(canvas);

            // Use JScanify for professional edge detection
            const contour = this.scanner!.findPaperContour(src);
            
            if (contour) {
              const cornerPoints = this.scanner!.getCornerPoints(contour) as CornerPoints | null;
              
              if (cornerPoints && this.isHighConfidenceDetection(cornerPoints, imageWidth, imageHeight)) {
                const cropArea = this.convertCornerPointsToCropArea(cornerPoints, imageWidth, imageHeight);
                const confidence = this.calculateConfidence(cornerPoints, imageWidth, imageHeight);
                
                // Clean up OpenCV objects
                src.delete();
                
                console.log('🎯 Smart detection successful with confidence:', confidence);
                resolve({
                  detected: true,
                  cropArea,
                  confidence,
                  cornerPoints
                });
                return;
              }
            }

            // Clean up OpenCV objects
            src.delete();
            
            console.log('📋 Smart detection failed, using fallback');
            resolve(this.getFallbackCropArea(imageWidth, imageHeight));
            
          } catch (error) {
            console.warn('⚠️ JScanify detection error:', error);
            resolve(this.getFallbackCropArea(imageWidth, imageHeight));
          }
        };
        
        img.onerror = () => {
          console.warn('⚠️ Image loading failed for detection');
          resolve(this.getFallbackCropArea(imageWidth, imageHeight));
        };

        img.src = imageData;
      });
    } catch (error) {
      console.error('❌ Smart detection error:', error);
      return this.getFallbackCropArea(imageWidth, imageHeight);
    }
  }

  /**
   * Check if this is a high-confidence detection
   */
  private isHighConfidenceDetection(
    cornerPoints: CornerPoints,
    imageWidth: number,
    imageHeight: number
  ): boolean {
    // Check if corner points form a reasonable rectangle
    const { topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner } = cornerPoints;
    
    // Calculate area of detected region
    const detectedWidth = Math.abs(topRightCorner.x - topLeftCorner.x);
    const detectedHeight = Math.abs(bottomLeftCorner.y - topLeftCorner.y);
    const detectedArea = detectedWidth * detectedHeight;
    const imageArea = imageWidth * imageHeight;
    
    // Detected area should be at least 20% of image but not more than 95%
    const areaRatio = detectedArea / imageArea;
    if (areaRatio < 0.2 || areaRatio > 0.95) {
      return false;
    }
    
    // Check if corners form a reasonable quadrilateral
    const minDistance = Math.min(imageWidth, imageHeight) * 0.1;
    const corners = [topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner];
    
    for (let i = 0; i < corners.length; i++) {
      const current = corners[i];
      const next = corners[(i + 1) % corners.length];
      const distance = Math.sqrt(
        Math.pow(next.x - current.x, 2) + Math.pow(next.y - current.y, 2)
      );
      
      if (distance < minDistance) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Convert JScanify corner points to crop area format
   */
  private convertCornerPointsToCropArea(
    cornerPoints: CornerPoints,
    imageWidth: number,
    imageHeight: number
  ): CropAreaPixels {
    const { topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner } = cornerPoints;
    
    const minX = Math.min(
      topLeftCorner.x,
      topRightCorner.x,
      bottomLeftCorner.x,
      bottomRightCorner.x
    );
    const maxX = Math.max(
      topLeftCorner.x,
      topRightCorner.x,
      bottomLeftCorner.x,
      bottomRightCorner.x
    );
    const minY = Math.min(
      topLeftCorner.y,
      topRightCorner.y,
      bottomLeftCorner.y,
      bottomRightCorner.y
    );
    const maxY = Math.max(
      topLeftCorner.y,
      topRightCorner.y,
      bottomLeftCorner.y,
      bottomRightCorner.y
    );

    return {
      x: Math.max(0, Math.round(minX)),
      y: Math.max(0, Math.round(minY)),
      width: Math.round(Math.min(maxX - minX, imageWidth - minX)),
      height: Math.round(Math.min(maxY - minY, imageHeight - minY))
    };
  }

  /**
   * Calculate confidence score for detection
   */
  private calculateConfidence(
    cornerPoints: CornerPoints,
    imageWidth: number,
    imageHeight: number
  ): number {
    const cropArea = this.convertCornerPointsToCropArea(cornerPoints, imageWidth, imageHeight);
    const detectedArea = cropArea.width * cropArea.height;
    const imageArea = imageWidth * imageHeight;
    const areaRatio = detectedArea / imageArea;
    
    // Higher confidence for reasonable area ratios
    if (areaRatio >= 0.4 && areaRatio <= 0.8) {
      return 0.9;
    } else if (areaRatio >= 0.2 && areaRatio <= 0.95) {
      return 0.7;
    } else {
      return 0.5;
    }
  }

  /**
   * Get fallback crop area when detection fails
   */
  private getFallbackCropArea(imageWidth: number, imageHeight: number): DetectionResult {
    return {
      detected: false,
      cropArea: {
        x: Math.round(imageWidth * 0.1),
        y: Math.round(imageHeight * 0.1),
        width: Math.round(imageWidth * 0.8),
        height: Math.round(imageHeight * 0.8)
      },
      confidence: 0.5
    };
  }

  /**
   * Check if JScanify is ready to use
   */
  isInitialized(): boolean {
    return this.isReady && this.scanner !== null;
  }
}

// Export singleton instance
export const jscanifyService = new JScanifyService();