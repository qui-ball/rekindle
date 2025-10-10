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

### Upload Flow Architecture (Updated)

**Key Change:** Perspective correction moved from post-upload (backend) to pre-upload (frontend) for instant user preview and better UX.

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
│ 4. Smart Cropping Interface         │  │ 4. Smart Cropping Interface         │
│    ↓                                │  │    ↓                                │
│ 5. Crop Adjustment                  │  │ 5. Crop Adjustment                  │
│    ↓                                │  │    ↓                                │
│ 6. *** UPLOAD PREVIEW ***           │  │ 6. *** UPLOAD PREVIEW ***           │
│    • Perspective Correction (<1s)   │  │    • Perspective Correction (<1s)   │
│    • Show corrected image           │  │    • Show corrected image           │
│    • Retake or Confirm buttons      │  │    • Retake or Confirm buttons      │
│    ↓                                │  │    ↓                                │
│ 7. Upload Corrected Image to S3     │  │ 7. Upload Corrected Image to S3     │
│                                     │  │                                     │
└─────────────────────────────────────┘  └─────────────────────────────────────┘
                    │                                  │
                    └──────────────┬───────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              UNIFIED PROCESSING                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  📤 Post-Upload Processing (Simplified - 70% cost reduction)                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ Thumbnail Generation → Metadata Extraction → Database Update            │   │
│  │ → Queue for AI Processing                                               │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  Note: Perspective correction now happens in frontend (step 6 above)          │
│  Benefits: Instant user preview, reduced backend costs, works offline         │
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
**Purpose:** Native-quality camera interface with dynamic aspect ratio that matches device camera app behavior
**Technology:** react-camera-pro with dynamic aspect ratio configuration for native camera app experience
**Props:**
```typescript
interface CameraCaptureProps {
  onCapture: (imageData: string) => void; // base64 encoded at full resolution
  onError: (error: CameraError) => void;
  facingMode: 'user' | 'environment'; // Default: 'environment'
  aspectRatio: number; // Dynamic: 3:4 mobile portrait, 4:3 mobile landscape/desktop
}
```

**Key Features:**
- Dynamic aspect ratio camera view matching native camera apps (3:4 mobile portrait, 4:3 mobile landscape/desktop)
- Maximum device resolution capture (4K/8MP+ when available) within dynamic aspect ratio constraints
- Portrait mode: camera view positioned at top, controls and indicators in bottom area
- Landscape mode: camera view positioned at left, controls and indicators in right area
- Advanced MediaDevices constraints for highest quality within dynamic aspect ratio
- Zero compression or downscaling during capture
- Native camera app layout with dedicated control areas
- Orientation-aware repositioning with dynamic aspect ratio adjustment
- Real-time quality indicators positioned in dedicated control areas

#### CameraCaptureFlow
**Purpose:** Manages complete camera capture workflow including preview state
**Props:**
```typescript
interface CameraCaptureFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageData: string) => void;
  onError: (error: CameraError) => void;
  closeOnEscape?: boolean;
  facingMode?: 'user' | 'environment';
  aspectRatio?: number;
}
```

**Key Features:**
- Full-screen modal overlay for camera capture
- Capture state with camera interface
- Preview state with accept/reject options
- Consistent UI control positioning across states
- Escape key handling for easy dismissal

#### SmartCropper
**Purpose:** Full-screen interactive cropping interface integrated into preview modal
**Technology:** react-easy-crop for touch-friendly cropping with full-screen layout
**Props:**
```typescript
interface SmartCropperProps {
  image: string; // base64 or URL
  onCropComplete: (croppedArea: CropArea, croppedAreaPixels: CropAreaPixels) => void;
  onCancel: () => void;
  initialCrop?: { x: number; y: number };
  initialZoom?: number;
  aspectRatio?: number; // Free-form by default
  isFullScreen?: boolean; // Default: true
}
```

**Key Features:**
- Full-screen cropping interface without padding or letterboxing
- Integrated into camera capture preview modal workflow
- Touch-optimized zoom and pan capabilities for mobile devices
- Consistent UI control positioning with camera capture interface
- Accept/reject buttons positioned similarly to camera controls
- Real-time crop preview with smooth interactions
- Responsive layout for both portrait and landscape orientations

#### SmartCropperModal
**Purpose:** Full-screen modal wrapper for cropping interface
**Props:**
```typescript
interface SmartCropperModalProps {
  isOpen: boolean;
  image: string;
  onCropComplete: (croppedImageData: string) => void;
  onCancel: () => void;
  closeOnEscape?: boolean;
}
```

**Key Features:**
- Full-screen modal overlay matching camera capture flow
- Integrated SmartCropper component with consistent styling
- Modal controls positioned consistently with camera interface
- Escape key handling and outside click dismissal

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

#### UploadPreview (NEW)
**Purpose:** Show perspective-corrected preview before upload
**Props:**
```typescript
interface UploadPreviewProps {
  originalImage: string; // Base64 image data
  cornerPoints: CornerPoints; // JScanify corner points from cropping
  onConfirm: (correctedImage: string) => void;
  onCancel: () => void;
}
```

**Key Features:**
- Applies perspective correction using OpenCV.js in <1 second
- Shows corrected image preview before upload
- Provides "Retake" and "Confirm" buttons
- Graceful fallback to original image if correction fails
- Works offline (uses already-loaded OpenCV.js)
- Displays processing time in development mode

**Implementation Notes:**
- Uses OpenCV.js `warpPerspective` for 4-point transform
- Calculates optimal output dimensions from corner points
- Handles timeout for slow devices (5 second max)
- Shows loading spinner during processing
- Falls back to original cropped image on error

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

#### PerspectiveCorrectionService (NEW)
**Purpose:** Frontend perspective correction using OpenCV.js
```typescript
interface PerspectiveCorrectionService {
  initialize(): Promise<boolean>;
  correctPerspective(
    imageData: string,
    cornerPoints: CornerPoints,
    outputWidth?: number,
    outputHeight?: number
  ): Promise<PerspectiveCorrectionResult>;
  isReady(): boolean;
}

interface PerspectiveCorrectionResult {
  success: boolean;
  correctedImageData?: string; // Base64 corrected image
  error?: string;
  processingTime?: number; // milliseconds
}
```

**Key Features:**
- Uses OpenCV.js `warpPerspective` for 4-point transform
- Processes images in <1 second on modern devices (300-800ms typical)
- Automatically calculates optimal output dimensions
- Graceful fallback if OpenCV.js unavailable
- Singleton pattern for app-wide reuse

**Performance:**
- Modern phones (2020+): 300-500ms
- Mid-range phones (2017-2019): 500-800ms  
- Older phones (2015-2016): 800-1200ms

#### ImagePreprocessor (NEW)
**Purpose:** Enhanced preprocessing for better smart cropping accuracy
```typescript
interface ImagePreprocessor {
  preprocessForDetection(src: OpenCVMat): OpenCVMat;
  enhanceEdges(src: OpenCVMat): OpenCVMat;
  applyAdaptiveThreshold(src: OpenCVMat): OpenCVMat;
  calculateMedianIntensity(src: OpenCVMat): number;
}
```

**Preprocessing Techniques:**
1. **CLAHE** (Contrast Limited Adaptive Histogram Equalization) - Improves edge visibility in poor lighting
2. **Bilateral Filtering** - Reduces noise while preserving edges
3. **Morphological Operations** - Cleans up detected edges
4. **Adaptive Thresholding** - Handles variable lighting conditions

**Expected Improvements:**
- Poor lighting: +25-30% accuracy
- Low contrast: +30-35% accuracy
- Noise/grain: +15-20% accuracy

#### MultiPassDetector (NEW)
**Purpose:** Professional-grade detection using multiple strategies
```typescript
interface MultiPassDetector {
  detectMultiPass(src: OpenCVMat): Promise<DetectionCandidate[]>;
  standardDetection(src: OpenCVMat): Promise<DetectionCandidate | null>;
  enhancedDetection(src: OpenCVMat): Promise<DetectionCandidate | null>;
  contourDetection(src: OpenCVMat): Promise<DetectionCandidate | null>;
  houghLineDetection(src: OpenCVMat): Promise<DetectionCandidate | null>;
  calculateConfidenceScore(cornerPoints: CornerPoints, src: OpenCVMat): number;
}

interface DetectionCandidate {
  cornerPoints: CornerPoints;
  confidence: number; // 0-1
  method: string; // 'jscanify-standard' | 'jscanify-enhanced' | 'contour-advanced' | 'hough-lines'
  reason: string;
}
```

**Detection Strategies:**
1. **Standard JScanify** - Baseline detection (~85% accuracy)
2. **Enhanced Preprocessing + JScanify** - With preprocessing (~90% accuracy)
3. **Contour Detection** - Alternative algorithm (~85% accuracy)
4. **Hough Line Detection** - For rectangular photos (~90% accuracy)

**Adaptive Strategy:**
- Quick single-pass for high-confidence photos (>0.85 confidence)
- Full multi-pass only for challenging photos (<0.85 confidence)
- Processing time: <500ms fast path, <1500ms multi-pass

**Expected Improvements:**
- Overall accuracy: 85-90% → 95-98%
- Poor lighting scenarios: 60-70% → 85-90%
- Complex backgrounds: 40-50% → 75-80%

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

## Architecture Decisions & Implementation Approach

### Decision: Frontend Perspective Correction

**Chosen Approach:** Perform perspective correction in the frontend using OpenCV.js

**Rationale:**
- ✅ **Zero additional dependencies** - OpenCV.js already loaded for JScanify (~8-10MB)
- ✅ **Instant user feedback** - <1 second vs 4-10 seconds for backend approach
- ✅ **No server round trip** - Saves time and reduces backend costs
- ✅ **Better UX** - Users confirm exact image being uploaded
- ✅ **Works offline** - No network required for correction
- ✅ **Cost savings** - 70% reduction in backend processing costs

**Performance Comparison:**
```
Frontend Approach:
- Perspective correction: 300-800ms
- User sees preview: <1 second
- Total: <1 second ✅

Backend Approach (OLD):
- Upload original: 2-5 seconds
- Backend processing: 1-2 seconds  
- Download preview: 1-3 seconds
- Total: 4-10 seconds ❌
```

**Implementation:**
- Service: `PerspectiveCorrectionService` using OpenCV.js `warpPerspective`
- Component: `UploadPreview` showing corrected image before upload
- Integration: Add preview state in `CameraCaptureFlow` between cropping and upload
- Fallback: Gracefully use original image if correction fails

### Decision: Multi-Pass Smart Cropping

**Chosen Approach:** Enhanced preprocessing + multi-pass detection with adaptive strategy

**Rationale:**
- ✅ **Professional-grade accuracy** - 95-98% vs current 85-90%
- ✅ **Handles challenging photos** - Poor lighting, low contrast, glare
- ✅ **Adaptive performance** - Fast path for easy photos, multi-pass for hard ones
- ✅ **Leverages existing OpenCV.js** - No additional dependencies

**Three-Tier Strategy:**

**Tier 1: Enhanced Preprocessing (+15-20% accuracy)**
- CLAHE for better contrast in poor lighting
- Bilateral filtering to reduce noise while preserving edges
- Morphological operations to clean up edges
- Adaptive thresholding for variable lighting
- **Effort:** 4-6 hours | **Impact:** Immediate improvement for all photos

**Tier 2: Multi-Pass Detection (+20-25% accuracy)**
- 4 parallel detection strategies (JScanify, enhanced, contour, Hough lines)
- Comprehensive confidence scoring (area, rectangularity, distribution, straightness)
- Intelligent candidate selection with consensus algorithm
- **Effort:** 8-10 hours | **Impact:** Catches difficult cases

**Tier 3: Adaptive Strategy (performance optimization)**
- Quick single-pass for high-confidence photos (>0.85)
- Full multi-pass only for low-confidence photos (<0.85)
- Web Worker parallelization for older devices
- **Effort:** 4-6 hours | **Impact:** Balanced speed vs quality

**Expected Accuracy Improvements:**
| Scenario | Current | With Tier 1 | With Tier 2 | Improvement |
|----------|---------|-------------|-------------|-------------|
| Well-lit photos | 85-90% | 90-95% | 95-98% | +10-13% |
| Poor lighting | 60-70% | 75-80% | 85-90% | +25-30% |
| Low contrast | 50-60% | 70-75% | 80-85% | +30-35% |
| Complex backgrounds | 40-50% | 60-65% | 75-80% | +35-40% |
| Glare/reflections | 30-40% | 55-60% | 70-75% | +40-45% |

### Implementation Priority

**Phase 1: MVP (High Priority)**
1. **Task 10.1-A:** Frontend Perspective Correction
   - Time: 6-8 hours
   - Impact: Instant user preview, 70% cost reduction
   - Dependencies: None (OpenCV.js already loaded)

2. **Task 5.6:** Enhanced Preprocessing
   - Time: 4-6 hours
   - Impact: +15-20% accuracy improvement
   - Dependencies: None

**Phase 2: Enhancement (Medium Priority)**
3. **Task 5.7:** Multi-Pass Detection
   - Time: 8-10 hours
   - Impact: +20-25% accuracy, professional-grade results
   - Dependencies: Task 5.6

4. **Task 10.1-B:** Backend Cleanup
   - Time: 2-3 hours
   - Impact: Simplify backend, reduce costs
   - Dependencies: Task 10.1-A

**Phase 3: Optimization (Low Priority)**
5. **Task 5.8:** Adaptive Strategy
   - Time: 4-6 hours
   - Impact: Faster processing, better battery life
   - Dependencies: Tasks 5.6 and 5.7

### Key Benefits Summary

**User Experience:**
- See corrected photo in <1 second instead of 4-10 seconds
- Confirm exact image before upload
- 95-98% detection accuracy instead of 85-90%
- Works offline

**Technical:**
- Reduced backend load
- 70% lower infrastructure costs
- Better error handling (retry on device vs server)
- Leverage existing OpenCV.js dependency

**Business:**
- Reduced AWS costs (less Lambda/ECS processing)
- Better user satisfaction scores
- Improved conversion rates (faster flow)
- At 10K uploads/month: Save $20-40/month
- At 100K uploads/month: Save $200-400/month

This design provides a comprehensive foundation for implementing the photo upload system while maintaining focus on user experience, reliability, and scalability for the MVP launch. The new perspective correction and smart cropping enhancements dramatically improve both user experience and accuracy while reducing costs.