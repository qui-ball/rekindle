// JScanify type definitions
import type { OpenCVMat } from './opencv';

export interface CornerPoint {
  x: number;
  y: number;
}

export interface CornerPoints {
  topLeftCorner: CornerPoint;
  topRightCorner: CornerPoint;
  bottomLeftCorner: CornerPoint;
  bottomRightCorner: CornerPoint;
}

export interface PaperContour {
  // OpenCV contour data structure
  data: Uint8Array;
  rows: number;
  cols: number;
  type: number;
}

declare module 'jscanify' {
  export default class JScanify {
    constructor();
    
    /**
     * Find paper contour in the image
     * @param image OpenCV Mat object
     * @returns Paper contour or null if not found
     */
    findPaperContour(image: OpenCVMat): PaperContour | null;
    
    /**
     * Get corner points from paper contour
     * @param contour Paper contour from findPaperContour
     * @returns Corner points object or null if invalid
     */
    getCornerPoints(contour: PaperContour | null): CornerPoints | null;
    
    /**
     * Extract paper from image using corner points
     * @param image OpenCV Mat object
     * @param cornerPoints Corner points from getCornerPoints
     * @param maxWidth Maximum width of extracted paper (default: 420)
     * @param maxHeight Maximum height of extracted paper (default: 594)
     * @returns Extracted paper as OpenCV Mat
     */
    extractPaper(
      image: OpenCVMat,
      cornerPoints: CornerPoints,
      maxWidth?: number,
      maxHeight?: number
    ): OpenCVMat;
  }
}