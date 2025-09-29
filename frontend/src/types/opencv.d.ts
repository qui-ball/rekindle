// OpenCV.js type definitions for JScanify integration

// Define specific OpenCV types
export interface OpenCVMat {
  rows: number;
  cols: number;
  type(): number;
  delete(): void;
}

export interface OpenCVSize {
  width: number;
  height: number;
}

export interface OpenCVPoint {
  x: number;
  y: number;
}

export interface OpenCVScalar {
  val: number[];
}

export interface OpenCVRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OpenCVMatVector {
  size(): number;
  get(index: number): OpenCVMat;
  push_back(mat: OpenCVMat): void;
  delete(): void;
}

declare global {
  interface Window {
    cv: OpenCVType;
  }
}

interface OpenCVType {
  Mat: new (...args: unknown[]) => OpenCVMat;
  imread: (element: HTMLImageElement | HTMLCanvasElement) => OpenCVMat;
  imshow: (canvasId: string, mat: OpenCVMat) => void;
  cvtColor: (src: OpenCVMat, dst: OpenCVMat, code: number) => void;
  threshold: (src: OpenCVMat, dst: OpenCVMat, thresh: number, maxval: number, type: number) => void;
  findContours: (image: OpenCVMat, contours: OpenCVMatVector, hierarchy: OpenCVMat, mode: number, method: number) => void;
  approxPolyDP: (curve: OpenCVMat, approxCurve: OpenCVMat, epsilon: number, closed: boolean) => void;
  contourArea: (contour: OpenCVMat) => number;
  boundingRect: (contour: OpenCVMat) => OpenCVRect;
  getPerspectiveTransform: (src: OpenCVMat, dst: OpenCVMat) => OpenCVMat;
  warpPerspective: (src: OpenCVMat, dst: OpenCVMat, M: OpenCVMat, dsize: OpenCVSize) => void;
  Size: new (width: number, height: number) => OpenCVSize;
  Point: new (x: number, y: number) => OpenCVPoint;
  Scalar: new (r: number, g: number, b: number, a?: number) => OpenCVScalar;
  MatVector: new () => OpenCVMatVector;
  // Color conversion codes
  COLOR_RGBA2GRAY: number;
  COLOR_RGB2GRAY: number;
  // Threshold types
  THRESH_BINARY: number;
  THRESH_BINARY_INV: number;
  // Contour retrieval modes
  RETR_EXTERNAL: number;
  RETR_LIST: number;
  RETR_CCOMP: number;
  RETR_TREE: number;
  // Contour approximation methods
  CHAIN_APPROX_NONE: number;
  CHAIN_APPROX_SIMPLE: number;
  // Memory management
  delete: (obj: OpenCVMat | OpenCVMatVector) => void;
}

// Export the type for use in other files
export type { OpenCVType };

export {};