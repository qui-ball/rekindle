# Design Document

## Overview

The Photo Upload System is designed as a Progressive Web App (PWA) component that provides multiple intuitive upload methods for our target demographic (30-60 year old families). The system prioritizes simplicity, reliability, and accessibility while handling various photo sources including physical photos, mobile galleries, and desktop files.

The design follows a mobile-first approach with camera capture as the primary method on mobile devices, while providing seamless desktop integration through drag-and-drop and QR code flows. All upload methods converge into a unified processing pipeline that prepares photos for AI restoration and colourization.

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                USER INTERFACE LAYER                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│  📱 Mobile Interface                    💻 Desktop Interface                   │
│  ┌─────────────────────────────────────┐ ┌─────────────────────────────────────┐ │
│  │ • Camera Capture Component          │ │ • Drag & Drop Zone                  │ │
│  │ • Gallery Picker Component          │ │ • File Browser Component            │ │
│  │ • Smart Cropping Interface          │ │ • QR Code Generator                 │ │
│  │ • Progress Tracking                 │ │ • Progress Tracking                 │ │
│  └─────────────────────────────────────┘ └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              UPLOAD ORCHESTRATION LAYER                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │ Upload Manager  │  │ File Validator  │  │ Progress Manager│                │
│  │ • Route uploads │  │ • Type checking │  │ • Status updates│                │
│  │ • Handle errors │  │ • Size limits   │  │ • Error handling│                │
│  │ • Retry logic   │  │ • Format conv.  │  │ • User feedback │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FILE PROCESSING LAYER                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │ Image Processor │  │ Cropping Engine │  │ Quality Enhancer│                │
│  │ • Format conv.  │  │ • Smart crop    │  │ • Perspective   │                │
│  │ • Compression   │  │ • Manual adjust │  │ • Brightness    │                │
│  │ • Metadata      │  │ • Preview gen.  │  │ • Contrast      │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              STORAGE & QUEUE LAYER                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │ AWS S3 Storage  │  │ Database        │  │ Redis Queue     │                │
│  │ • Secure upload │  │ • Photo metadata│  │ • Processing    │                │
│  │ • Signed URLs   │  │ • User tracking │  │ • Job status    │                │
│  │ • CDN delivery  │  │ • Status updates│  │ • Priority mgmt │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Upload Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              UPLOAD FLOW DIAGRAM                               │
└─────────────────────────────────────────────────────────────────────────────────┘

📱 Mobile Camera Flow                    💻 Desktop Upload Flow
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│                                     │  │                                     │
│ 1. Camera Permission Request        │  │ 1. Drag & Drop Zone Display        │
│    ↓                                │  │    ↓                                │
│ 2. Camera Interface (Back Camera)   │  │ 2. File Drop/Browse Selection       │
│    ↓                                │  │    ↓                                │
│ 3. Visual Guides & Capture          │  │ 3. File Validation                  │
│    ↓                                │  │    ↓                                │
│ 4. Smart Cropping Interface         │  │ 4. Cropping Interface               │
│    ↓                                │  │    ↓                                │
│ 5. Crop Adjustment & Preview        │  │ 5. Upload to S3                     │
│    ↓                                │  │    ↓                                │
│ 6. Upload to S3                     │  │ 6. Post-processing                  │
│                                     │  │                                     │
└─────────────────────────────────────┘  └─────────────────────────────────────┘
                    │                                  │
                    └──────────────┬───────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              UNIFIED PROCESSING                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  📤 Post-Upload Processing                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ Perspective Correction → Quality Enhancement → Thumbnail Generation     │   │
│  │ → Metadata Extraction → Database Update → Queue for AI Processing      │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Core React Components

#### PhotoUploadContainer
**Purpose:** Main orchestration component that manages upload state and routing
**Props:**
```typescript
interface PhotoUploadContainerProps {
  onUploadComplete: (result: UploadResult) => void;
  onError: (error: UploadError) => void;
  maxFileSize?: number; // Default: 50MB
  allowedFormats?: string[]; // Default: ['image/jpeg', 'image/png', 'image/heic', 'image/webp']
}
```

#### CameraCapture
**Purpose:** Mobile camera interface with guided capture experience
**Technology:** react-camera-pro for PWA camera integration
**Props:**
```typescript
interface CameraCaptureProps {
  onCapture: (imageData: string) => void; // base64 encoded
  onError: (error: CameraError) => void;
  facingMode: 'user' | 'environment'; // Default: 'environment'
  aspectRatio?: number; // Default: 4/3
}
```

**Key Features:**
- Back camera as default for physical photo capture
- Visual guides overlay for optimal positioning
- Multiple shot capability with quality selection
- Real-time lighting feedback

#### SmartCropper
**Purpose:** Interactive cropping interface for all upload methods
**Technology:** react-easy-crop for touch-friendly cropping
**Props:**
```typescript
interface SmartCropperProps {
  image: string; // base64 or URL
  onCropComplete: (croppedArea: CropArea, croppedAreaPixels: CropAreaPixels) => void;
  initialCrop?: { x: number; y: number };
  initialZoom?: number;
  aspectRatio?: number; // Free-form by default
}
```

**Key Features:**
- Draggable corner/edge points for precise adjustment
- Real-time preview of cropped result
- Touch-optimized for mobile devices
- Zoom and pan capabilities

#### DragDropZone
**Purpose:** Desktop file upload interface with drag-and-drop support
**Props:**
```typescript
interface DragDropZoneProps {
  onFileSelect: (file: File) => void;
  onError: (error: FileError) => void;
  accept: string; // MIME types
  maxSize: number;
  disabled?: boolean;
}
```

**Key Features:**
- Large, intuitive drop area with visual feedback
- File browser fallback for traditional selection
- Progress indicators with thumbnails
- Clear error messaging and retry options

#### QRCodeUpload
**Purpose:** Desktop-to-mobile upload flow via QR code
**Props:**
```typescript
interface QRCodeUploadProps {
  onMobileUploadComplete: (result: UploadResult) => void;
  sessionTimeout?: number; // Default: 5 minutes
}
```

**Key Features:**
- Automatic QR code generation and refresh
- Real-time session status updates
- Cross-device progress synchronization

### Service Layer Interfaces

#### UploadService
**Purpose:** Core upload orchestration and S3 integration
```typescript
interface UploadService {
  uploadFile(file: File, options: UploadOptions): Promise<UploadResult>;
  generatePresignedUrl(fileName: string, fileType: string): Promise<string>;
  trackProgress(uploadId: string, callback: ProgressCallback): void;
  cancelUpload(uploadId: string): Promise<void>;
}

interface UploadOptions {
  onProgress?: (progress: number) => void;
  onError?: (error: UploadError) => void;
  chunkSize?: number; // For large files
  retryAttempts?: number; // Default: 3
}
```

#### FileProcessor
**Purpose:** Client-side file processing and validation
```typescript
interface FileProcessor {
  validateFile(file: File): ValidationResult;
  convertFormat(file: File, targetFormat: string): Promise<File>;
  generateThumbnail(file: File, maxSize: number): Promise<string>;
  extractMetadata(file: File): Promise<FileMetadata>;
  compressImage(file: File, quality: number): Promise<File>;
}
```

#### CropProcessor
**Purpose:** Handle cropping operations and coordinate transformations
```typescript
interface CropProcessor {
  applyCrop(imageData: string, cropArea: CropAreaPixels): Promise<string>;
  detectEdges(imageData: string): Promise<EdgeDetectionResult>;
  suggestCrop(imageData: string): Promise<CropSuggestion>;
  correctPerspective(imageData: string): Promise<string>;
}
```

## Data Models

### Upload State Management
```typescript
interface UploadState {
  status: 'idle' | 'selecting' | 'cropping' | 'uploading' | 'processing' | 'complete' | 'error';
  progress: number; // 0-100
  currentStep: UploadStep;
  selectedFile?: File;
  croppedImage?: string;
  uploadResult?: UploadResult;
  error?: UploadError;
}

interface UploadResult {
  uploadId: string;
  fileKey: string;
  thumbnailUrl: string;
  originalFileName: string;
  fileSize: number;
  dimensions: { width: number; height: number };
  processingStatus: 'queued' | 'processing' | 'complete';
}

interface UploadError {
  code: string;
  message: string;
  retryable: boolean;
  details?: any;
}
```

### File Validation Schema
```typescript
interface FileValidationRules {
  maxSize: number; // 50MB
  minDimensions: { width: number; height: number }; // 200x200
  maxDimensions: { width: number; height: number }; // 8000x8000
  allowedTypes: string[]; // ['image/jpeg', 'image/png', 'image/heic', 'image/webp']
  allowedExtensions: string[]; // ['.jpg', '.jpeg', '.png', '.heic', '.webp']
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}
```

### Processing Pipeline Data
```typescript
interface ProcessingJob {
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
  metadata: {
    originalDimensions: { width: number; height: number };
    processedDimensions: { width: number; height: number };
    fileSize: number;
    format: string;
    uploadMethod: 'camera' | 'gallery' | 'desktop' | 'qr';
  };
  createdAt: Date;
  completedAt?: Date;
}
```

## Error Handling

### Error Classification System
```typescript
enum ErrorType {
  VALIDATION_ERROR = 'validation_error',
  UPLOAD_ERROR = 'upload_error',
  PROCESSING_ERROR = 'processing_error',
  NETWORK_ERROR = 'network_error',
  PERMISSION_ERROR = 'permission_error',
  STORAGE_ERROR = 'storage_error'
}

interface ErrorHandler {
  handleError(error: UploadError): ErrorResponse;
  getRetryStrategy(error: UploadError): RetryStrategy;
  getUserMessage(error: UploadError): string;
}
```

### User-Friendly Error Messages
- **File too large:** "This photo is too large. Please try a smaller image or use our mobile camera for best results."
- **Unsupported format:** "This file type isn't supported. Please use JPG, PNG, or HEIC photos."
- **Camera permission denied:** "We need camera access to take photos. Please allow camera permission and try again."
- **Network error:** "Upload failed due to connection issues. Please check your internet and try again."
- **Storage full:** "Unable to upload right now. Please try again in a few minutes."

### Retry Logic
```typescript
interface RetryStrategy {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
  retryableErrors: ErrorType[];
}

const defaultRetryStrategy: RetryStrategy = {
  maxAttempts: 3,
  backoffMultiplier: 2,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  retryableErrors: [ErrorType.NETWORK_ERROR, ErrorType.UPLOAD_ERROR]
};
```

## Testing Strategy

### Unit Testing Focus
- **File validation logic:** All supported formats, size limits, dimension checks
- **Cropping calculations:** Coordinate transformations, aspect ratio handling
- **Error handling:** All error scenarios and user message generation
- **Upload progress tracking:** Progress calculation and status updates

### Integration Testing
- **Camera API integration:** Permission handling, capture functionality
- **S3 upload flow:** Presigned URLs, chunked uploads, progress tracking
- **Cross-device QR flow:** Session management, real-time synchronization
- **File processing pipeline:** End-to-end upload to processing queue

### Mobile Testing Priorities
- **Camera capture on various devices:** iOS Safari, Android Chrome
- **Touch interactions:** Cropping interface, drag gestures
- **PWA functionality:** Offline capability, app-like behavior
- **Performance:** Large file handling, memory management

### Error Scenario Testing
- **Network interruptions:** Upload resumption, retry logic
- **Permission denials:** Graceful fallbacks, clear messaging
- **File corruption:** Validation and error handling
- **Storage limits:** Quota exceeded scenarios

This design provides a comprehensive foundation for implementing the photo upload system while maintaining focus on user experience, reliability, and scalability for the MVP launch.