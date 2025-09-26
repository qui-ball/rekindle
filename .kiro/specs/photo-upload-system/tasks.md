# Implementation Plan

- [x] 1. Set up project structure and core interfaces
  - Create directory structure for upload components, services, and utilities
  - Define TypeScript interfaces for upload state, file validation, and error handling
  - Set up basic React component structure with proper imports
  - _Requirements: 1.1, 2.1, 3.1, 5.1_

- [ ] 2. Implement file validation and processing utilities
  - [x] 2.1 Create file validation service with type and size checking
    - Write FileValidator class with methods for format, size, and dimension validation
    - Implement HEIC to JPEG conversion utility
    - Create unit tests for all validation scenarios
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6_

  - [ ] 2.2 Build file processing utilities for metadata and thumbnails
    - Implement thumbnail generation from uploaded files
    - Create metadata extraction utility for image dimensions and format
    - Write image compression utility for large files
    - _Requirements: 6.5, 5.1_

  - [x] 2.3 Implement format-specific conversion libraries
    - Replace canvas-based conversion with dedicated libraries per format
    - HEIC files: Use heic2any library for HEIC → JPEG conversion
    - PNG/JPEG/WebP files: Use browser-image-compression for optimization and standardization
    - Add format detection and route to appropriate conversion library
    - Implement quality settings and format options for each converter
    - Add comprehensive tests for all format conversion scenarios
    - _Requirements: 6.6, Performance, Browser Compatibility, Format Optimization_

  - [ ] 2.4 Optimize file validation performance
    - Implement streaming validation for large files to reduce memory usage
    - Add validation result caching to avoid repeated validations
    - Optimize dimension checking with progressive loading techniques
    - Add file size pre-checks before full validation
    - _Requirements: Performance, Memory Optimization, User Experience_

## Task Details

### Task 2.3: Format-Specific Conversion Implementation
**Priority**: High (affects all uploaded image formats)
**Estimated Time**: 6-8 hours
**Dependencies**: Task 2.1 (FileValidator)

**Detailed Requirements:**

**Format-Specific Libraries:**
- **HEIC files**: `heic2any` library (MIT, 1M+ downloads) for HEIC → JPEG conversion
- **PNG/JPEG/WebP files**: `browser-image-compression` (MIT, 9M+ downloads) for optimization
- **Format detection**: Automatic routing to appropriate conversion library
- **Unified interface**: Single conversion service that handles all formats

**Implementation Strategy:**
- Create `FormatConverter` service with format-specific handlers
- HEIC conversion: heic2any with 0.92 quality for AI processing
- Standard formats: browser-image-compression for size/quality optimization
- Fallback strategies for unsupported browsers or conversion failures
- Web Worker integration for non-blocking conversion
- Progress tracking for large file conversions
- Memory management and cleanup for all converters

**Quality Settings by Format:**
- HEIC → JPEG: 0.92 quality (high detail for AI processing)
- PNG optimization: Lossless compression with size reduction
- JPEG optimization: 0.9 quality with resolution optimization
- WebP handling: Convert to JPEG for maximum AI compatibility

**Acceptance Criteria:**
- All supported formats convert reliably across browsers
- HEIC files convert to high-quality JPEG suitable for AI processing
- PNG/JPEG files are optimized without quality loss for AI processing
- Large files (>20MB) convert without blocking UI
- Conversion maintains metadata when possible
- Proper error handling and user feedback for all formats
- Test coverage includes real files from various sources (iOS, Android, cameras)

### Task 2.4: File Validation Performance Optimization
**Priority**: Medium (improves user experience for large files)
**Estimated Time**: 6-8 hours
**Dependencies**: Task 2.1 (FileValidator)

**Detailed Requirements:**
- Implement streaming file validation to reduce memory footprint
- Add LRU cache for validation results (keyed by file hash)
- Optimize image dimension checking with progressive loading
- Add file size pre-validation before expensive operations
- Implement validation result memoization for repeated files
- Add performance monitoring and metrics collection
- Create configurable validation strategies (fast vs. thorough)
- Implement lazy loading for dimension validation

**Performance Targets:**
- Validate 50MB files without exceeding 100MB memory usage
- Dimension checking completes in <2 seconds for typical photos
- Cache hit rate >80% for repeated file validations
- UI remains responsive during validation of large files

**Acceptance Criteria:**
- Memory usage stays below 100MB for 50MB file validation
- Validation performance improves by 50% for repeated files
- Large file validation doesn't block UI interactions
- Performance metrics are collected and reportable
- Graceful degradation for low-memory devices

## Implementation Notes

### Task 2.3 Technical Approach:
```typescript
// Format-specific conversion service
import heic2any from 'heic2any';
import imageCompression from 'browser-image-compression';

export class FormatConverter {
  async convertToOptimalFormat(file: File): Promise<File> {
    const fileType = this.detectFileType(file);
    
    switch (fileType) {
      case 'heic':
        return this.convertHeicToJpeg(file);
      case 'png':
      case 'jpeg':
      case 'webp':
        return this.optimizeStandardFormat(file);
      default:
        throw new Error(`Unsupported format: ${fileType}`);
    }
  }
  
  private async convertHeicToJpeg(file: File): Promise<File> {
    const convertedBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92, // High quality for AI processing
    }) as Blob;
    
    return new File([convertedBlob], 
      file.name.replace(/\.heic$/i, '.jpg'), 
      { type: 'image/jpeg' }
    );
  }
  
  private async optimizeStandardFormat(file: File): Promise<File> {
    const options = {
      maxSizeMB: 50, // Respect our upload limit
      maxWidthOrHeight: 8000, // Respect our dimension limits
      useWebWorker: true,
      fileType: 'image/jpeg', // Standardize to JPEG for AI processing
      quality: 0.9
    };
    
    return await imageCompression(file, options);
  }
}
```

### Task 2.4 Technical Approach:
```typescript
// Performance-optimized validation
export class FileValidator {
  private validationCache = new LRUCache<string, ValidationResult>(100);
  
  async validateFile(file: File): Promise<ValidationResult> {
    // Quick pre-validation
    const preCheck = this.preValidateFile(file);
    if (!preCheck.valid) return preCheck;
    
    // Check cache
    const cacheKey = await this.generateFileHash(file);
    const cached = this.validationCache.get(cacheKey);
    if (cached) return cached;
    
    // Streaming validation for large files
    const result = file.size > 10 * 1024 * 1024 
      ? await this.validateFileStreaming(file)
      : await this.validateFileStandard(file);
    
    this.validationCache.set(cacheKey, result);
    return result;
  }
}
```

- [ ] 3. Create drag-and-drop upload interface for desktop
  - [ ] 3.1 Build DragDropZone component with visual feedback
    - Create React component with drag-and-drop event handlers
    - Implement visual feedback for drag-over states
    - Add file browser fallback functionality
    - Write unit tests for drag-and-drop interactions
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ] 3.2 Integrate file validation with drag-and-drop interface
    - Connect FileValidator service with drag-and-drop component
    - Display validation errors and warnings in the UI
    - Handle HEIC conversion workflow in drag-and-drop context
    - _Requirements: 3.1, 2.1, 2.3_
    - Connect FileValidator service to DragDropZone component
    - Implement error display for invalid files
    - Add progress tracking for file processing
    - _Requirements: 3.6, 5.1, 5.2, 5.6_

- [ ] 4. Implement mobile camera capture functionality
  - [x] 4.1 Set up react-camera-pro integration for PWA camera access
    - Install and configure react-camera-pro library
    - Create CameraCapture component with back camera default
    - Implement camera permission handling and error states
    - Write unit tests for camera component initialization
    - _Requirements: 1.1, 1.2, 1.6, 7.5_

  - [x] 4.2 Add visual guides and capture interface for physical photos
    - Create overlay component with positioning guides for physical photos
    - Implement capture button with visual feedback
    - Add lighting quality detection and user guidance
    - _Requirements: 1.3, 1.6, 8.1, 8.2_

- [ ] 5. Build smart cropping interface
  - [ ] 5.1 Integrate react-easy-crop for interactive cropping
    - Install and configure react-easy-crop library
    - Create SmartCropper component with touch-optimized controls
    - Implement draggable corner points for crop adjustment
    - Write unit tests for cropping coordinate calculations
    - _Requirements: 1.4, 1.5, 2.4, 8.3_

  - [ ] 5.2 Add real-time preview and crop application
    - Implement real-time preview of cropped result
    - Create crop application utility to generate final cropped image
    - Add zoom and pan functionality for precise adjustments
    - _Requirements: 1.5, 2.4_

- [ ] 6. Create mobile gallery access functionality
  - [ ] 6.1 Implement native photo picker integration
    - Create GalleryPicker component using HTML file input
    - Configure file input for image selection with proper MIME types
    - Implement file selection confirmation and preview
    - Write unit tests for gallery selection flow
    - _Requirements: 2.1, 2.2, 2.3, 2.6_

  - [ ] 6.2 Connect gallery picker to cropping interface
    - Integrate GalleryPicker with SmartCropper component
    - Handle HEIC format conversion for iOS photos
    - Implement error handling for unsupported formats
    - _Requirements: 2.4, 2.5, 2.6_

- [ ] 7. Build upload orchestration and progress tracking
  - [ ] 7.1 Create UploadService for S3 integration
    - Implement UploadService class with presigned URL generation
    - Create chunked upload functionality for large files
    - Add upload progress tracking with percentage completion
    - Write unit tests for upload service methods
    - _Requirements: 5.1, 5.2, 5.3, 7.1, 7.2_

  - [ ] 7.2 Implement upload state management and error handling
    - Create upload state reducer for managing upload flow
    - Implement retry logic with exponential backoff
    - Add comprehensive error handling with user-friendly messages
    - _Requirements: 5.4, 5.5, 5.6, 8.3, 8.4_

- [ ] 8. Create main PhotoUploadContainer orchestration component
  - [ ] 8.1 Build container component to coordinate all upload methods
    - Create PhotoUploadContainer with state management for upload flow
    - Implement routing between camera, gallery, and desktop upload methods
    - Add method selection interface with clear visual guidance
    - Write integration tests for component interactions
    - _Requirements: 8.1, 8.2, 8.4_

  - [ ] 8.2 Integrate all upload methods into unified flow
    - Connect CameraCapture, GalleryPicker, and DragDropZone to container
    - Implement unified cropping flow for all upload methods
    - Add upload completion handling and success feedback
    - _Requirements: 5.3, 5.4, 8.4_

- [ ] 9. Implement QR code desktop-to-mobile flow
  - [ ] 9.1 Create QR code generation and session management
    - Build QRCodeUpload component with session ID generation
    - Implement QR code display with automatic refresh
    - Create session timeout handling and cleanup
    - Write unit tests for session management
    - _Requirements: 4.1, 4.2, 4.6_

  - [ ] 9.2 Build cross-device synchronization for QR flow
    - Implement real-time session status updates between devices
    - Add mobile upload completion notification to desktop
    - Create session cleanup and error handling
    - _Requirements: 4.3, 4.4, 4.5_

- [ ] 10. Add post-upload processing pipeline
  - [ ] 10.1 Implement perspective correction and quality enhancement
    - Create image processing utilities for perspective correction
    - Add automatic quality enhancement for photo-of-photo captures
    - Implement thumbnail generation for processed images
    - Write unit tests for image processing functions
    - _Requirements: 6.5, 1.6_

  - [ ] 10.2 Create database integration for upload tracking
    - Implement database models for photo uploads and processing jobs
    - Create API endpoints for upload status tracking
    - Add metadata storage for uploaded files
    - _Requirements: 7.3, 5.4, 5.5_

- [ ] 11. Implement comprehensive error handling and user feedback
  - [ ] 11.1 Create user-friendly error messaging system
    - Implement ErrorHandler class with categorized error types
    - Create plain-language error messages for all scenarios
    - Add contextual help and retry options for errors
    - Write unit tests for error message generation
    - _Requirements: 8.3, 8.5, 8.6_

  - [ ] 11.2 Add accessibility and user guidance features
    - Implement tooltips and contextual help for upload methods
    - Add keyboard navigation support for all components
    - Create step-by-step guidance for first-time users
    - _Requirements: 8.1, 8.2, 8.5, 8.6_

- [ ] 12. Build comprehensive testing suite
  - [ ] 12.1 Create unit tests for all components and services
    - Write unit tests for file validation, cropping, and upload services
    - Create component tests for all React components
    - Add error handling and edge case tests
    - _Requirements: All requirements validation_

  - [ ] 12.2 Implement integration tests for upload flows
    - Create integration tests for complete upload flows
    - Add cross-device QR flow testing
    - Implement mobile camera and gallery integration tests
    - _Requirements: End-to-end flow validation_

- [ ] 13. Optimize performance and add PWA features
  - [ ] 13.1 Implement performance optimizations for large files
    - Add image compression before upload
    - Implement progressive upload with chunking
    - Create memory management for large file processing
    - _Requirements: Performance and scalability_

  - [ ] 13.2 Add PWA features for offline capability
    - Implement service worker for offline upload queuing
    - Add background sync for failed uploads
    - Create offline status indicators and messaging
    - _Requirements: PWA functionality and reliability_