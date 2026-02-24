// OpenCV.js type definitions for JScanify integration

// Define specific OpenCV types
export interface OpenCVMat {
  rows: number;
  cols: number;
  type(): number;
  delete(): void;
  data32F: Float32Array;
  clone(): OpenCVMat;
  copyTo(dst: OpenCVMat): void;
  channels(): number;
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
  Mat: {
    new (...args: unknown[]): OpenCVMat;
    ones(rows: number, cols: number, type: number): OpenCVMat;
  };
  imread: (element: HTMLImageElement | HTMLCanvasElement) => OpenCVMat;
  imshow: (canvasIdOrElement: string | HTMLCanvasElement, mat: OpenCVMat) => void;
  cvtColor: (src: OpenCVMat, dst: OpenCVMat, code: number, dstCn?: number) => void;
  threshold: (src: OpenCVMat, dst: OpenCVMat, thresh: number, maxval: number, type: number) => void;
  findContours: (image: OpenCVMat, contours: OpenCVMatVector, hierarchy: OpenCVMat, mode: number, method: number) => void;
  approxPolyDP: (curve: OpenCVMat, approxCurve: OpenCVMat, epsilon: number, closed: boolean) => void;
  contourArea: (contour: OpenCVMat) => number;
  boundingRect: (contour: OpenCVMat) => OpenCVRect;
  getPerspectiveTransform: (src: OpenCVMat, dst: OpenCVMat) => OpenCVMat;
  warpPerspective: (
    src: OpenCVMat,
    dst: OpenCVMat,
    M: OpenCVMat,
    dsize: OpenCVSize,
    flags?: number,
    borderMode?: number,
    borderValue?: OpenCVScalar
  ) => void;
  
  // Additional methods for ImagePreprocessor
  bilateralFilter: (src: OpenCVMat, dst: OpenCVMat, d: number, sigmaColor: number, sigmaSpace: number, borderType: number) => void;
  GaussianBlur: (src: OpenCVMat, dst: OpenCVMat, ksize: OpenCVSize, sigmaX: number, sigmaY: number, borderType: number) => void;
  addWeighted: (src1: OpenCVMat, alpha: number, src2: OpenCVMat, beta: number, gamma: number, dst: OpenCVMat) => void;
  morphologyEx: (src: OpenCVMat, dst: OpenCVMat, op: number, kernel: OpenCVMat) => void;
  adaptiveThreshold: (src: OpenCVMat, dst: OpenCVMat, maxValue: number, adaptiveMethod: number, thresholdType: number, blockSize: number, C: number) => void;
  mean: (src: OpenCVMat) => number[];
  
  // CLAHE class
  CLAHE: new (clipLimit: number, tileGridSize: OpenCVSize) => {
    apply: (src: OpenCVMat, dst: OpenCVMat) => void;
    delete: () => void;
  };
  
  // Interpolation flags
  INTER_LINEAR: number;
  // Border types
  BORDER_CONSTANT: number;
  BORDER_DEFAULT: number;
  Size: new (width: number, height: number) => OpenCVSize;
  Point: new (x: number, y: number) => OpenCVPoint;
  Scalar: new (r?: number, g?: number, b?: number, a?: number) => OpenCVScalar;
  MatVector: new () => OpenCVMatVector;
  
  // Color conversion codes
  COLOR_RGBA2GRAY: number;
  COLOR_RGB2GRAY: number;
  COLOR_GRAY2RGBA: number;
  
  // Threshold types
  THRESH_BINARY: number;
  THRESH_BINARY_INV: number;
  ADAPTIVE_THRESH_MEAN_C: number;
  
  // Morphological operations
  MORPH_CLOSE: number;
  MORPH_OPEN: number;
  
  // Contour retrieval modes
  RETR_EXTERNAL: number;
  RETR_LIST: number;
  RETR_CCOMP: number;
  RETR_TREE: number;
  // Contour approximation methods
  CHAIN_APPROX_NONE: number;
  CHAIN_APPROX_SIMPLE: number;
  // Mat types
  CV_32FC2: number;
  CV_8U: number;
  // Memory management
  delete: (obj: OpenCVMat | OpenCVMatVector) => void;
}

// Export the type for use in other files
export type { OpenCVType };

export {};