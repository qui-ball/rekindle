# Implementation Plan

- [x] 1. Set up project structure and core interfaces
  - Create directory structure for upload components, services, and utilities
  - Define TypeScript interfaces for upload state, file validation, and error handling
  - Set up basic React component structure with proper imports
  - _Requirements: 1.1, 2.1, 3.1, 5.1_

- [x] 1.5. Create supporting camera components and examples
  - [x] 1.5.1 Build CameraCaptureModal wrapper component
    - Create modal wrapper for camera capture flow functionality
    - Implement portal rendering for proper z-index layering
    - Add consistent props interface with CameraCaptureFlow
    - _Requirements: 1.1, 1.2_

  - [x] 1.5.2 Create camera capture example and test components
    - Build CameraCaptureExample component demonstrating full camera workflow
    - Create LandscapeTest component for testing responsive layouts
    - Add comprehensive test coverage for camera capture components
    - Implement PhotoUploadContainer test suite
    - _Requirements: Testing and validation_

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

### Task 5.1: JScanify Integration for Professional Smart Cropping
**Priority**: High (core feature for 98%+ accuracy requirement)
**Estimated Time**: 8-10 hours
**Dependencies**: Task 4.4 (Camera capture flow)

**Detailed Requirements:**

**JScanify Integration:**
- **Library**: JScanify (MIT license, built on OpenCV.js) for professional document/photo edge detection
- **OpenCV.js**: ~8-10MB dependency, loaded asynchronously during app initialization
- **Accuracy**: 95-98% detection accuracy for well-lit photos with clear edges
- **Processing time**: 0.5-2 seconds on modern mobile devices, 2-4 seconds on older devices

**Implementation Strategy:**
- Replace existing basic PhotoDetector with JScanify-powered SmartPhotoDetector
- Implement app-level preloading of OpenCV.js to avoid delays during photo capture
- Create graceful fallback system when JScanify fails to load or detect edges
- Add confidence scoring to determine when to use smart detection vs. generic crop area
- Integrate with existing QuadrilateralCropper for manual adjustment capability

**Performance Optimization:**
- Load OpenCV.js during app initialization with loading screen (one-time 2-5 second delay)
- Cache OpenCV.js in browser for instant subsequent app loads
- Show processing indicator during 0.5-2 second edge detection phase
- Implement progressive enhancement: generic crop first, then smart detection overlay

**Acceptance Criteria:**
- JScanify loads successfully during app initialization with proper error handling
- Edge detection achieves 95%+ accuracy for well-lit photos with clear boundaries
- Processing completes within 2 seconds on modern devices, 4 seconds on older devices
- Graceful fallback to generic crop area when detection fails or confidence is low
- Seamless integration with existing quadrilateral cropper interface
- No delays during photo capture (processing happens after capture)
- Proper error handling and user feedback for all failure scenarios

### Task 5.2: App Initialization and OpenCV.js Preloading
**Priority**: High (required for seamless user experience)
**Estimated Time**: 4-6 hours
**Dependencies**: None

**Detailed Requirements:**
- Create app-level initialization service to preload OpenCV.js during startup
- Implement loading screen with progress indicator and user-friendly messaging
- Add initialization state management (loading/ready/fallback)
- Handle OpenCV.js loading failures with graceful degradation to basic cropping
- Cache OpenCV.js for instant loading on subsequent app visits
- Add timeout handling for slow network connections

**User Experience:**
- Show "Preparing smart photo detection..." message during initial load
- Display progress indicator for OpenCV.js download
- Provide "This happens once" reassurance message
- Gracefully handle loading failures without breaking app functionality

**Acceptance Criteria:**
- OpenCV.js loads successfully during app startup with proper progress indication
- Loading screen provides clear feedback and doesn't feel broken
- App functions normally even if OpenCV.js fails to load
- Subsequent app visits are instant (cached OpenCV.js)
- Proper error handling for network failures and timeouts

### Task 5.3: QuadrilateralCropper Enhancement for JScanify Integration
**Priority**: High (maintains manual adjustment capability)
**Estimated Time**: 4-6 hours
**Dependencies**: Task 5.1 (JScanify integration)

**Detailed Requirements:**
- Modify existing QuadrilateralCropper to accept JScanify corner point format
- Convert JScanify corner points to quadrilateral coordinates for existing UI
- Maintain all existing functionality: circular draggable corners, touch support, grid overlay
- Add confidence indicator to show detection quality to users
- Ensure seamless transition between automatic detection and manual adjustment

**JScanify Corner Point Integration:**
- JScanify returns corner points in format: `{topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner}`
- Convert to existing QuadrilateralArea format for UI consistency
- Handle coordinate system differences between JScanify and display coordinates
- Maintain existing scaling and positioning logic for different image sizes

**Acceptance Criteria:**
- JScanify corner points display correctly in existing quadrilateral interface
- All existing manual adjustment functionality continues to work
- Smooth transition from automatic detection to manual refinement
- Confidence indicator provides useful feedback to users
- No regression in existing cropper performance or usability

## Implementation Notes

### Task 5.1 Technical Approach:
```typescript
// JScanify-powered smart photo detector
import jscanify from 'jscanify';

export class SmartPhotoDetector {
  private scanner: jscanify | null = null;
  private isReady: boolean = false;

  constructor() {
    // Scanner will be initialized after OpenCV.js loads
  }

  async initialize(): Promise<boolean> {
    try {
      // Wait for OpenCV.js to be available
      if (typeof cv === 'undefined') {
        throw new Error('OpenCV.js not loaded');
      }
      
      this.scanner = new jscanify();
      this.isReady = true;
      return true;
    } catch (error) {
      console.warn('JScanify initialization failed:', error);
      this.isReady = false;
      return false;
    }
  }

  async detectPhotoBoundaries(
    imageData: string,
    imageWidth: number,
    imageHeight: number
  ): Promise<DetectionResult> {
    if (!this.isReady || !this.scanner) {
      return this.getFallbackCropArea(imageWidth, imageHeight);
    }

    try {
      const img = new Image();
      img.src = imageData;
      
      return new Promise((resolve) => {
        img.onload = () => {
          try {
            // Use JScanify for professional edge detection
            const cornerPoints = this.scanner!.getCornerPoints(
              this.scanner!.findPaperContour(cv.imread(img))
            );
            
            if (cornerPoints && this.isHighConfidenceDetection(cornerPoints)) {
              resolve({
                detected: true,
                cropArea: this.convertCornerPointsToCropArea(cornerPoints, imageWidth, imageHeight),
                confidence: this.calculateConfidence(cornerPoints, imageWidth, imageHeight)
              });
            } else {
              resolve(this.getFallbackCropArea(imageWidth, imageHeight));
            }
          } catch (error) {
            console.warn('JScanify detection failed:', error);
            resolve(this.getFallbackCropArea(imageWidth, imageHeight));
          }
        };
        
        img.onerror = () => {
          resolve(this.getFallbackCropArea(imageWidth, imageHeight));
        };
      });
    } catch (error) {
      console.error('Smart detection error:', error);
      return this.getFallbackCropArea(imageWidth, imageHeight);
    }
  }

  private convertCornerPointsToCropArea(
    cornerPoints: any,
    imageWidth: number,
    imageHeight: number
  ): CropAreaPixels {
    // Convert JScanify corner points to crop area format
    const minX = Math.min(
      cornerPoints.topLeftCorner.x,
      cornerPoints.topRightCorner.x,
      cornerPoints.bottomLeftCorner.x,
      cornerPoints.bottomRightCorner.x
    );
    const maxX = Math.max(
      cornerPoints.topLeftCorner.x,
      cornerPoints.topRightCorner.x,
      cornerPoints.bottomLeftCorner.x,
      cornerPoints.bottomRightCorner.x
    );
    const minY = Math.min(
      cornerPoints.topLeftCorner.y,
      cornerPoints.topRightCorner.y,
      cornerPoints.bottomLeftCorner.y,
      cornerPoints.bottomRightCorner.y
    );
    const maxY = Math.max(
      cornerPoints.topLeftCorner.y,
      cornerPoints.topRightCorner.y,
      cornerPoints.bottomLeftCorner.y,
      cornerPoints.bottomRightCorner.y
    );

    return {
      x: Math.max(0, Math.round(minX)),
      y: Math.max(0, Math.round(minY)),
      width: Math.round(Math.min(maxX - minX, imageWidth - minX)),
      height: Math.round(Math.min(maxY - minY, imageHeight - minY))
    };
  }

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
}
```

### Task 5.2 Technical Approach:
```typescript
// App initialization with OpenCV.js preloading
export const useOpenCVInitialization = () => {
  const [initState, setInitState] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [smartDetector, setSmartDetector] = useState<SmartPhotoDetector | null>(null);

  useEffect(() => {
    const initializeOpenCV = async () => {
      try {
        // Load OpenCV.js asynchronously
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://docs.opencv.org/4.7.0/opencv.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load OpenCV.js'));
          document.head.appendChild(script);
        });

        // Wait for OpenCV to be ready
        await new Promise<void>((resolve) => {
          const checkOpenCV = () => {
            if (typeof cv !== 'undefined' && cv.Mat) {
              resolve();
            } else {
              setTimeout(checkOpenCV, 100);
            }
          };
          checkOpenCV();
        });

        // Initialize smart detector
        const detector = new SmartPhotoDetector();
        const success = await detector.initialize();
        
        if (success) {
          setSmartDetector(detector);
          setInitState('ready');
        } else {
          setInitState('fallback');
        }
      } catch (error) {
        console.warn('OpenCV initialization failed:', error);
        setInitState('fallback');
      }
    };

    initializeOpenCV();
  }, []);

  return { initState, smartDetector };
};
```

- [ ] 3. Create drag-and-drop upload interface for desktop
  - [ ] 3.1 Build DragDropZone component with visual feedback
    - Create React component with drag-and-drop event handlers
    - Implement visual feedback for drag-over states
    - Add file browser fallback functionality
    - Write unit tests for drag-and-drop interactions
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ] 3.2 Integrate drag-and-drop with smart cropping interface
    - Connect DragDropZone with JScanify-powered smart cropping
    - Apply smart photo detection to drag-and-dropped images
    - Display validation errors and warnings in the UI
    - Handle HEIC conversion workflow before smart detection
    - Add progress tracking for file processing and smart detection
    - _Requirements: 3.1, 3.6, 5.1, 5.2, 5.6, Smart detection integration_

- [x] 4. Implement mobile camera capture functionality
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

  - [x] 4.3 Implement full-screen camera capture with responsive controls
    - Remove aspect ratio constraints to achieve true full-screen capture
    - Implement CSS overrides using position: fixed for video element
    - Add responsive UI control positioning for portrait and landscape modes
    - Position quality indicators and capture button appropriately for mobile landscape
    - Ensure camera fills entire screen without padding or letterboxing
    - Add mobile landscape media queries for cross-device compatibility
    - _Requirements: 1.3, 1.4, 1.5, 8.5, 8.6_

  - [x] 4.4 Update camera capture flow to skip preview state
    - Modify CameraCaptureFlow component to go directly from capture to cropping
    - Remove preview state with accept/reject options
    - Implement direct transition from photo capture to intelligent cropping interface
    - Ensure captured photo displays at full resolution without resizing
    - Maintain escape key handling and modal dismissal functionality
    - _Requirements: 8.1, 1.6, 1.7_

  - [x] 4.5 Implement native camera quality and layout behavior
    - Remove all aspect ratio constraints from camera configuration
    - Implement maximum resolution MediaDevices constraints for highest quality capture
    - Create native camera layout with fixed capture areas (top in portrait, left in landscape)
    - Implement advanced CSS viewport manipulation for true full-screen native behavior
    - Position UI controls outside main capture area to match native camera apps
    - Add orientation-aware control positioning that adapts seamlessly
    - Ensure zero compression or downscaling during photo capture
    - Test across multiple Android and iOS devices for consistent native behavior
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_

- [ ] 5. Build professional smart cropping with JScanify integration
  - [x] 5.0 Install JScanify dependencies and update package configuration
    - Install jscanify package (MIT license) via npm
    - Configure webpack/build system to handle OpenCV.js (~8-10MB) properly
    - Add async script loading configuration for OpenCV.js CDN
    - Update package.json with new dependencies and build scripts
    - Configure TypeScript types for jscanify and OpenCV.js integration
    - _Requirements: Dependency management, Build configuration_

  - [ ] 5.1 Replace PhotoDetector with JScanify for 98%+ accuracy
    - Remove existing basic PhotoDetector service implementation
    - Install JScanify library (MIT license) and OpenCV.js dependency
    - Create SmartPhotoDetector service using JScanify for professional edge detection
    - Implement preloading strategy during app initialization to avoid capture delays
    - Add graceful fallback to generic crop area when JScanify fails to load
    - Write unit tests for JScanify integration and fallback scenarios
    - _Requirements: 8.2, 8.3, 8.4, Professional accuracy requirement_

  - [ ] 5.2 Implement app initialization with OpenCV.js preloading
    - Create app-level initialization service to load OpenCV.js during startup
    - Add loading screen with progress indicator during OpenCV.js download (~8-10MB)
    - Implement initialization state management (loading/ready/fallback)
    - Add error handling for OpenCV.js loading failures with graceful degradation
    - Cache OpenCV.js in browser for instant subsequent app loads
    - _Requirements: Performance optimization, User experience_

  - [ ] 5.3 Enhance QuadrilateralCropper with JScanify corner points
    - Modify existing QuadrilateralCropper to accept JScanify corner point format
    - Convert JScanify corner points to quadrilateral crop area coordinates
    - Maintain existing circular draggable corner handles for manual adjustment
    - Ensure seamless integration between automatic detection and manual refinement
    - Add confidence indicator showing detection quality to user
    - _Requirements: 8.5, 8.6, 8.7, Manual adjustment capability_

  - [ ] 5.4 Integrate smart detection into camera capture flow
    - Update CameraCaptureFlow to use SmartPhotoDetector service
    - Add processing indicator during 0.5-2 second edge detection phase
    - Implement progressive enhancement: show generic crop first, then smart detection
    - Handle detection failures gracefully without blocking user workflow
    - Add "Smart cropping applied" notification when high-confidence detection succeeds
    - _Requirements: 8.1, 8.7, 8.8, Seamless user experience_

  - [ ] 5.5 Add performance monitoring and optimization
    - Implement processing time tracking for JScanify operations
    - Add device capability detection for processing time estimation
    - Create performance metrics collection for smart detection accuracy
    - Implement memory management for large image processing
    - Add user feedback for processing delays on slower devices
    - _Requirements: Performance monitoring, User experience optimization_

- [ ] 6. Create mobile gallery access functionality
  - [ ] 6.1 Implement native photo picker integration with preview flow
    - Create GalleryPicker component using HTML file input
    - Configure file input for image selection with proper MIME types
    - Implement full-screen preview state with accept/reject options
    - Write unit tests for gallery selection and preview flow
    - _Requirements: 2.1, 2.2, 2.3, 2.6_

  - [ ] 6.2 Connect gallery picker to smart cropping interface
    - Integrate GalleryPicker with JScanify-powered smart cropping
    - Apply smart photo detection to gallery-selected images
    - Ensure consistent full-screen layout and control positioning
    - Handle HEIC format conversion for iOS photos before smart detection
    - Implement error handling for unsupported formats and detection failures
    - _Requirements: 2.4, 2.5, 2.6, 8.5, Smart detection integration_

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

  - [ ] 8.2 Integrate all upload methods with unified smart cropping
    - Connect CameraCapture, GalleryPicker, and DragDropZone to container
    - Implement unified JScanify-powered smart cropping flow for all upload methods
    - Ensure consistent smart detection behavior across camera, gallery, and desktop uploads
    - Add upload completion handling and success feedback with detection confidence
    - _Requirements: 5.3, 5.4, 8.4, Unified smart detection experience_

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
  - [ ] 13.1 Implement performance optimizations for large files and smart detection
    - Add image compression before upload to reduce processing time
    - Implement progressive upload with chunking for large files
    - Create memory management for large file processing and OpenCV.js operations
    - Add performance monitoring for JScanify processing times across devices
    - Implement device capability detection for smart detection timeout adjustments
    - _Requirements: Performance and scalability, Smart detection optimization_

  - [ ] 13.2 Add PWA features for offline capability
    - Implement service worker for offline upload queuing
    - Add background sync for failed uploads
    - Create offline status indicators and messaging
    - Handle OpenCV.js caching and offline availability for smart detection
    - _Requirements: PWA functionality and reliability, Offline smart detection_