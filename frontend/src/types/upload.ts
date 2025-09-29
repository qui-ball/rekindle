/**
 * Core upload system type definitions
 * Defines interfaces for upload state, file validation, and error handling
 */

// Upload State Management
export interface UploadState {
  status: 'idle' | 'selecting' | 'cropping' | 'uploading' | 'processing' | 'complete' | 'error';
  progress: number; // 0-100
  currentStep: UploadStep;
  selectedFile?: File;
  croppedImage?: string;
  uploadResult?: UploadResult;
  error?: UploadError;
}

export type UploadStep = 
  | 'method_selection'
  | 'file_selection' 
  | 'cropping'
  | 'uploading'
  | 'processing'
  | 'complete';

// Upload Results and Options
export interface UploadResult {
  uploadId: string;
  fileKey: string;
  thumbnailUrl: string;
  originalFileName: string;
  fileSize: number;
  dimensions: { width: number; height: number };
  processingStatus: 'queued' | 'processing' | 'complete';
}

export interface UploadOptions {
  onProgress?: (progress: number) => void;
  onError?: (error: UploadError) => void;
  chunkSize?: number; // For large files
  retryAttempts?: number; // Default: 3
}

export type ProgressCallback = (progress: number) => void;

// Error Handling Types
export enum ErrorType {
  VALIDATION_ERROR = 'validation_error',
  UPLOAD_ERROR = 'upload_error',
  PROCESSING_ERROR = 'processing_error',
  NETWORK_ERROR = 'network_error',
  PERMISSION_ERROR = 'permission_error',
  STORAGE_ERROR = 'storage_error'
}

export interface UploadError extends Error {
  code: string;
  type: ErrorType;
  retryable: boolean;
  details?: unknown;
}

export interface RetryStrategy {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
  retryableErrors: ErrorType[];
}

// File Validation Types
export interface FileValidationRules {
  maxSize: number; // 50MB
  minDimensions: { width: number; height: number }; // 200x200
  maxDimensions: { width: number; height: number }; // 8000x8000
  allowedTypes: string[]; // ['image/jpeg', 'image/png', 'image/heic', 'image/webp']
  allowedExtensions: string[]; // ['.jpg', '.jpeg', '.png', '.heic', '.webp']
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
}

// File Metadata Types
export interface FileMetadata {
  originalDimensions: { width: number; height: number };
  fileSize: number;
  format: string;
  uploadMethod: 'camera' | 'gallery' | 'desktop' | 'qr';
  timestamp: Date;
  exifData?: Record<string, unknown>;
}

// Cropping Types
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CropAreaPixels = CropArea & {
  // Pixel-based crop coordinates (same as CropArea but semantically different)
};

export interface EdgeDetectionResult {
  edges: Array<{ x: number; y: number }>;
  confidence: number;
  suggestedCrop?: CropArea;
}

export interface CropSuggestion {
  cropArea: CropArea;
  confidence: number;
  reason: string;
}

// Processing Pipeline Types
export interface ProcessingJob {
  id: string;
  userId: string;
  originalFileKey: string;
  processedFileKey?: string;
  thumbnailKey: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  processingOptions: {
    perspectiveCorrection: boolean;
    qualityEnhancement: boolean;
    smartCropping: boolean;
  };
  metadata: FileMetadata;
  createdAt: Date;
  completedAt?: Date;
}

// Camera Types
export interface CameraError {
  code: string;
  message: string;
  name: string;
}

// QR Code Upload Types
export interface QRSession {
  sessionId: string;
  qrCode: string;
  status: 'pending' | 'connected' | 'uploading' | 'complete' | 'expired';
  expiresAt: Date;
  uploadResult?: UploadResult;
}

// Component Props Types
export interface PhotoUploadContainerProps {
  onUploadComplete: (result: UploadResult) => void;
  onError: (error: UploadError) => void;
  maxFileSize?: number; // Default: 50MB
  allowedFormats?: string[]; // Default: ['image/jpeg', 'image/png', 'image/heic', 'image/webp']
}

export interface CameraCaptureProps {
  onCapture: (imageData: string) => void; // base64 encoded at full resolution
  onError: (error: CameraError) => void;
  facingMode?: 'user' | 'environment'; // Default: 'environment'
  aspectRatio?: number; // Default: 4/3 (dynamic: 3/4 mobile portrait, 4/3 mobile landscape/desktop)
}



export interface DragDropZoneProps {
  onFileSelect: (file: File) => void;
  onError: (error: UploadError) => void;
  accept: string; // MIME types
  maxSize: number;
  disabled?: boolean;
}

export interface QRCodeUploadProps {
  onMobileUploadComplete: (result: UploadResult) => void;
  sessionTimeout?: number; // Default: 5 minutes
}

export interface FileError extends UploadError {
  file?: File;
}