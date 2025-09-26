import { CropAreaPixels } from '../types/upload';

export interface DetectionResult {
  detected: boolean;
  cropArea: CropAreaPixels;
  confidence: number;
}

/**
 * PhotoDetector service for automatic photo boundary detection
 * Uses canvas-based edge detection to find rectangular photo frames
 */
export class PhotoDetector {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get canvas context');
    }
    this.ctx = context;
  }

  /**
   * Detect photo boundaries in an image
   * @param imageData - Base64 image data or image URL
   * @param imageWidth - Actual image width
   * @param imageHeight - Actual image height
   * @returns Detection result with crop area
   */
  async detectPhotoBoundaries(
    imageData: string,
    imageWidth: number,
    imageHeight: number
  ): Promise<DetectionResult> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          // Set canvas size to match image
          this.canvas.width = imageWidth;
          this.canvas.height = imageHeight;
          
          // Draw image to canvas
          this.ctx.drawImage(img, 0, 0, imageWidth, imageHeight);
          
          // Get image data for processing
          const imageDataArray = this.ctx.getImageData(0, 0, imageWidth, imageHeight);
          
          // Apply edge detection
          const edges = this.detectEdges(imageDataArray);
          
          // Find rectangular contours
          const rectangles = this.findRectangles(edges, imageWidth, imageHeight);
          
          if (rectangles.length > 0) {
            // Use the largest rectangle as the photo boundary
            const bestRectangle = rectangles.reduce((prev, current) => 
              (current.width * current.height) > (prev.width * prev.height) ? current : prev
            );
            
            resolve({
              detected: true,
              cropArea: bestRectangle,
              confidence: this.calculateConfidence(bestRectangle, imageWidth, imageHeight)
            });
          } else {
            // Fallback to generic crop area (80% center)
            resolve({
              detected: false,
              cropArea: this.getGenericCropArea(imageWidth, imageHeight),
              confidence: 0.5
            });
          }
        } catch (error) {
          console.error('Error detecting photo boundaries:', error);
          // Fallback to generic crop area
          resolve({
            detected: false,
            cropArea: this.getGenericCropArea(imageWidth, imageHeight),
            confidence: 0.5
          });
        }
      };

      img.onerror = () => {
        // Fallback to generic crop area
        resolve({
          detected: false,
          cropArea: this.getGenericCropArea(imageWidth, imageHeight),
          confidence: 0.5
        });
      };

      img.src = imageData;
    });
  }

  /**
   * Simple edge detection using Sobel operator
   */
  private detectEdges(imageData: ImageData): number[][] {
    const { data, width, height } = imageData;
    const edges: number[][] = Array(height).fill(null).map(() => Array(width).fill(0));
    
    // Sobel kernels
    const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        
        // Apply Sobel kernels
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            
            gx += gray * sobelX[ky + 1][kx + 1];
            gy += gray * sobelY[ky + 1][kx + 1];
          }
        }
        
        // Calculate edge magnitude
        edges[y][x] = Math.sqrt(gx * gx + gy * gy);
      }
    }
    
    return edges;
  }

  /**
   * Find rectangular contours in edge data
   */
  private findRectangles(edges: number[][], width: number, height: number): CropAreaPixels[] {
    const rectangles: CropAreaPixels[] = [];
    const threshold = 50; // Edge threshold
    
    // Simple rectangle detection using edge density
    const blockSize = 20; // Size of blocks to analyze
    
    for (let y = 0; y < height - blockSize; y += blockSize) {
      for (let x = 0; x < width - blockSize; x += blockSize) {
        const rect = this.analyzeBlock(edges, x, y, blockSize, blockSize, threshold);
        if (rect) {
          rectangles.push(rect);
        }
      }
    }
    
    // Merge overlapping rectangles and filter by size
    return this.mergeRectangles(rectangles, width, height);
  }

  /**
   * Analyze a block for rectangular patterns
   */
  private analyzeBlock(
    edges: number[][],
    startX: number,
    startY: number,
    blockWidth: number,
    blockHeight: number,
    threshold: number
  ): CropAreaPixels | null {
    let edgeCount = 0;
    let totalPixels = 0;
    
    // Count edge pixels in the block
    for (let y = startY; y < Math.min(startY + blockHeight, edges.length); y++) {
      for (let x = startX; x < Math.min(startX + blockWidth, edges[0].length); x++) {
        totalPixels++;
        if (edges[y][x] > threshold) {
          edgeCount++;
        }
      }
    }
    
    // If edge density is high enough, consider it a potential rectangle
    const edgeDensity = edgeCount / totalPixels;
    if (edgeDensity > 0.1) { // 10% edge density threshold
      return {
        x: startX,
        y: startY,
        width: blockWidth,
        height: blockHeight
      };
    }
    
    return null;
  }

  /**
   * Merge overlapping rectangles and filter by size
   */
  private mergeRectangles(rectangles: CropAreaPixels[], imageWidth: number, imageHeight: number): CropAreaPixels[] {
    if (rectangles.length === 0) return [];
    
    // Filter rectangles by minimum size (at least 20% of image)
    const minArea = (imageWidth * imageHeight) * 0.2;
    const filtered = rectangles.filter(rect => 
      (rect.width * rect.height) > minArea
    );
    
    if (filtered.length === 0) return [];
    
    // For simplicity, return the largest rectangle
    // In a more sophisticated implementation, we would merge overlapping rectangles
    return [filtered.reduce((prev, current) => 
      (current.width * current.height) > (prev.width * prev.height) ? current : prev
    )];
  }

  /**
   * Calculate confidence score for detected rectangle
   */
  private calculateConfidence(rect: CropAreaPixels, imageWidth: number, imageHeight: number): number {
    const area = rect.width * rect.height;
    const imageArea = imageWidth * imageHeight;
    const areaRatio = area / imageArea;
    
    // Higher confidence for rectangles that cover 40-80% of the image
    if (areaRatio >= 0.4 && areaRatio <= 0.8) {
      return 0.8;
    } else if (areaRatio >= 0.2 && areaRatio <= 0.9) {
      return 0.6;
    } else {
      return 0.4;
    }
  }

  /**
   * Get generic crop area (80% center) when no photo is detected
   */
  private getGenericCropArea(imageWidth: number, imageHeight: number): CropAreaPixels {
    const margin = 0.1; // 10% margin on each side
    return {
      x: Math.round(imageWidth * margin),
      y: Math.round(imageHeight * margin),
      width: Math.round(imageWidth * (1 - 2 * margin)),
      height: Math.round(imageHeight * (1 - 2 * margin))
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    // Canvas cleanup is handled by garbage collection
  }
}

export default PhotoDetector;