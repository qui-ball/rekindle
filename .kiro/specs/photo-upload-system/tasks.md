# Implementation Plan

## Requirements Coverage Summary

This tasks file covers all requirements from requirements.md:

| Requirement | Description | Covered By Tasks |
|-------------|-------------|------------------|
| Req 1 | Camera capture with native quality | 4.1, 4.2, 4.3, 4.4, 4.5, 4.6 |
| Req 2 | Gallery photo selection | 6.1, 6.2 |
| Req 3 | Desktop drag & drop upload | 3.1, 3.2 |
| Req 4 | QR code desktop-to-mobile flow | 9.1, 9.2 |
| Req 5 | Progress feedback and status updates | 7.1, 7.2 |
| Req 6 | File format and size validation | 2.1, 2.2, 2.3, 2.4 |
| Req 7 | Security and privacy | 7.1, 10.2 |
| Req 8 | Smart cropping with edge detection | 5.1, 5.2, 5.3, 5.4, 5.9 |
| Req 9 | Simple and intuitive interface | 8.1, 8.2, 11.1, 11.2 |
| Req 10 | Native camera app experience | 4.3, 4.4, 4.5, 4.6 |
| Req 11 | Upload preview with perspective correction | 10.1-A |
| Req 12 | Enhanced smart cropping accuracy (95%+) | 5.6, 5.7, 5.8, 5.9 |

All 12 requirements are fully covered by implementation tasks.

---

## Task Breakdown

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

### Task 4.6 Technical Approach:
```typescript
// Enhanced corner guide overlay with real-time computer vision detection
interface GuideDetectionState {
  portrait: {
    hasContent: boolean;
    confidence: number;
    detectedCorners?: CornerPoints;
  };
  landscape: {
    hasContent: boolean;
    confidence: number;
    detectedCorners?: CornerPoints;
  };
}

interface CornerGuideProps {
  isVisible: boolean;
  isMobile?: boolean;
  onGuidePositionChange?: (corners: CornerPoints, orientation: 'portrait' | 'landscape') => void;
  onDetectionChange?: (detection: GuideDetectionState) => void;
  className?: string;
}

// Guide content detector using OpenCV.js for real-time analysis
export class GuideContentDetector {
  private isInitialized = false;
  private detectionInterval: number | null = null;
  private onDetectionChange?: (detection: GuideDetectionState) => void;

  async initialize(): Promise<boolean> {
    try {
      // Ensure OpenCV.js is loaded
      if (typeof cv === 'undefined') {
        await this.loadOpenCV();
      }
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.warn('GuideContentDetector initialization failed:', error);
      return false;
    }
  }

  startDetection(
    cameraStream: MediaStream,
    portraitCorners: CornerPoints,
    landscapeCorners: CornerPoints,
    onDetectionChange: (detection: GuideDetectionState) => void
  ): void {
    this.onDetectionChange = onDetectionChange;
    
    // Start real-time detection every 100ms
    this.detectionInterval = window.setInterval(() => {
      this.analyzeFrame(cameraStream, portraitCorners, landscapeCorners);
    }, 100);
  }

  stopDetection(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
  }

  private async analyzeFrame(
    stream: MediaStream,
    portraitCorners: CornerPoints,
    landscapeCorners: CornerPoints
  ): Promise<void> {
    if (!this.isInitialized || !this.onDetectionChange) return;

    try {
      // Capture current frame from camera stream
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      ctx?.drawImage(video, 0, 0);
      const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
      
      if (!imageData) return;

      // Convert to OpenCV Mat
      const src = cv.matFromImageData(imageData);
      
      // Analyze portrait guide area
      const portraitDetection = await this.detectRectangularContent(
        src, 
        portraitCorners, 
        canvas.width, 
        canvas.height
      );
      
      // Analyze landscape guide area
      const landscapeDetection = await this.detectRectangularContent(
        src, 
        landscapeCorners, 
        canvas.width, 
        canvas.height
      );
      
      // Update detection state
      const detectionState: GuideDetectionState = {
        portrait: portraitDetection,
        landscape: landscapeDetection
      };
      
      this.onDetectionChange(detectionState);
      
      src.delete(); // Clean up OpenCV Mat
    } catch (error) {
      console.warn('Frame analysis failed:', error);
    }
  }

  private async detectRectangularContent(
    src: cv.Mat,
    corners: CornerPoints,
    imageWidth: number,
    imageHeight: number
  ): Promise<{ hasContent: boolean; confidence: number; detectedCorners?: CornerPoints }> {
    try {
      // Crop to guide area
      const roi = this.createROIFromCorners(src, corners, imageWidth, imageHeight);
      
      // Apply preprocessing for better edge detection
      const processed = this.preprocessForDetection(roi);
      
      // Detect edges using Canny
      const edges = new cv.Mat();
      cv.Canny(processed, edges, 50, 150);
      
      // Find contours
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      
      // Analyze contours for rectangular shapes
      const rectangularContours = this.findRectangularContours(contours);
      
      // Calculate confidence based on contour quality
      const confidence = this.calculateDetectionConfidence(rectangularContours, roi);
      
      // Clean up
      roi.delete();
      processed.delete();
      edges.delete();
      contours.delete();
      hierarchy.delete();
      
      return {
        hasContent: confidence > 0.7,
        confidence,
        detectedCorners: confidence > 0.7 ? this.extractCornerPoints(rectangularContours) : undefined
      };
    } catch (error) {
      console.warn('Rectangular content detection failed:', error);
      return { hasContent: false, confidence: 0 };
    }
  }

  private preprocessForDetection(src: cv.Mat): cv.Mat {
    const processed = new cv.Mat();
    
    // Convert to grayscale
    cv.cvtColor(src, processed, cv.COLOR_RGBA2GRAY);
    
    // Apply Gaussian blur to reduce noise
    const blurred = new cv.Mat();
    cv.GaussianBlur(processed, blurred, new cv.Size(5, 5), 0);
    
    // Apply CLAHE for better contrast
    const clahe = cv.createCLAHE(2.0, new cv.Size(8, 8));
    const enhanced = new cv.Mat();
    clahe.apply(blurred, enhanced);
    
    // Clean up
    processed.delete();
    blurred.delete();
    
    return enhanced;
  }

  private findRectangularContours(contours: cv.MatVector): cv.Mat[] {
    const rectangularContours: cv.Mat[] = [];
    
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      
      // Filter by area (too small or too large)
      if (area < 1000 || area > 100000) {
        contour.delete();
        continue;
      }
      
      // Approximate contour to polygon
      const epsilon = 0.02 * cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, epsilon, true);
      
      // Check if it's roughly rectangular (4 corners)
      if (approx.rows === 4) {
        rectangularContours.push(approx);
      } else {
        approx.delete();
      }
      
      contour.delete();
    }
    
    return rectangularContours;
  }

  private calculateDetectionConfidence(contours: cv.Mat[], roi: cv.Mat): number {
    if (contours.length === 0) return 0;
    
    // Use the largest contour
    let bestContour = contours[0];
    let maxArea = cv.contourArea(bestContour);
    
    for (let i = 1; i < contours.length; i++) {
      const area = cv.contourArea(contours[i]);
      if (area > maxArea) {
        bestContour = contours[i];
        maxArea = area;
      }
    }
    
    // Calculate confidence based on area ratio and rectangularity
    const roiArea = roi.rows * roi.cols;
    const areaRatio = maxArea / roiArea;
    
    // Ideal area ratio is 0.3-0.8
    let confidence = 0;
    if (areaRatio >= 0.3 && areaRatio <= 0.8) {
      confidence = 0.9;
    } else if (areaRatio >= 0.2 && areaRatio <= 0.9) {
      confidence = 0.7;
    } else {
      confidence = 0.3;
    }
    
    return Math.min(confidence, 1.0);
  }

  private extractCornerPoints(contours: cv.Mat[]): CornerPoints {
    if (contours.length === 0) {
      throw new Error('No contours to extract corner points from');
    }
    
    // Use the largest contour
    const contour = contours.reduce((best, current) => 
      cv.contourArea(current) > cv.contourArea(best) ? current : best
    );
    
    // Extract 4 corner points
    const points: cv.Point[] = [];
    for (let i = 0; i < contour.rows; i++) {
      const point = contour.data32S.slice(i * 2, i * 2 + 2);
      points.push(new cv.Point(point[0], point[1]));
    }
    
    // Sort points to get top-left, top-right, bottom-left, bottom-right
    points.sort((a, b) => a.y - b.y); // Sort by y first
    const topPoints = points.slice(0, 2).sort((a, b) => a.x - b.x);
    const bottomPoints = points.slice(2, 4).sort((a, b) => a.x - b.x);
    
    return {
      topLeft: { x: topPoints[0].x, y: topPoints[0].y },
      topRight: { x: topPoints[1].x, y: topPoints[1].y },
      bottomLeft: { x: bottomPoints[0].x, y: bottomPoints[0].y },
      bottomRight: { x: bottomPoints[1].x, y: bottomPoints[1].y }
    };
  }

  private createROIFromCorners(
    src: cv.Mat, 
    corners: CornerPoints, 
    imageWidth: number, 
    imageHeight: number
  ): cv.Mat {
    // Convert screen coordinates to image coordinates
    const scaleX = imageWidth / window.innerWidth;
    const scaleY = imageHeight / window.innerHeight;
    
    const roiCorners = {
      topLeft: { x: corners.topLeft.x * scaleX, y: corners.topLeft.y * scaleY },
      topRight: { x: corners.topRight.x * scaleX, y: corners.topRight.y * scaleY },
      bottomLeft: { x: corners.bottomLeft.x * scaleX, y: corners.bottomLeft.y * scaleY },
      bottomRight: { x: corners.bottomRight.x * scaleX, y: corners.bottomRight.y * scaleY }
    };
    
    // Create ROI rectangle
    const x = Math.min(roiCorners.topLeft.x, roiCorners.bottomLeft.x);
    const y = Math.min(roiCorners.topLeft.y, roiCorners.topRight.y);
    const width = Math.max(roiCorners.topRight.x, roiCorners.bottomRight.x) - x;
    const height = Math.max(roiCorners.bottomLeft.y, roiCorners.bottomRight.y) - y;
    
    const rect = new cv.Rect(x, y, width, height);
    return src.roi(rect);
  }

  private async loadOpenCV(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof cv !== 'undefined') {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://docs.opencv.org/4.7.0/opencv.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load OpenCV.js'));
      document.head.appendChild(script);
    });
  }
}

// Enhanced CornerGuideOverlay with real-time detection
export const CornerGuideOverlay: React.FC<CornerGuideProps> = ({
  isVisible,
  isMobile = false,
  onGuidePositionChange,
  onDetectionChange,
  className = ''
}) => {
  const [dualCorners, setDualCorners] = useState<DualCornerPoints | null>(null);
  const [detectedOrientation, setDetectedOrientation] = useState<'portrait' | 'landscape' | null>(null);
  const [detectionState, setDetectionState] = useState<GuideDetectionState | null>(null);
  const [showPortraitGuides, setShowPortraitGuides] = useState(true);
  const [showLandscapeGuides, setShowLandscapeGuides] = useState(true);
  const [isAligned, setIsAligned] = useState(false);
  const [isHighContrast, setIsHighContrast] = useState(false);
  
  const detectorRef = useRef<GuideContentDetector | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // Initialize computer vision detector
  useEffect(() => {
    const initializeDetector = async () => {
      if (!detectorRef.current) {
        detectorRef.current = new GuideContentDetector();
        await detectorRef.current.initialize();
      }
    };
    
    if (isVisible) {
      initializeDetector();
    }
  }, [isVisible]);

  // Start/stop real-time detection
  useEffect(() => {
    if (isVisible && detectorRef.current && dualCorners && cameraStreamRef.current) {
      const handleDetectionChange = (detection: GuideDetectionState) => {
        setDetectionState(detection);
        
        // Smart hiding logic based on detection results
        if (detection.portrait.hasContent && detection.portrait.confidence > 0.8) {
          setShowLandscapeGuides(false);
          setDetectedOrientation('portrait');
          onGuidePositionChange?.(dualCorners.portrait, 'portrait');
        } else if (detection.landscape.hasContent && detection.landscape.confidence > 0.8) {
          setShowPortraitGuides(false);
          setDetectedOrientation('landscape');
          onGuidePositionChange?.(dualCorners.landscape, 'landscape');
        } else {
          setShowPortraitGuides(true);
          setShowLandscapeGuides(true);
          setDetectedOrientation(null);
        }
        
        onDetectionChange?.(detection);
      };
      
      detectorRef.current.startDetection(
        cameraStreamRef.current,
        dualCorners.portrait,
        dualCorners.landscape,
        handleDetectionChange
      );
    }
    
    return () => {
      if (detectorRef.current) {
        detectorRef.current.stopDetection();
      }
    };
  }, [isVisible, dualCorners, onGuidePositionChange, onDetectionChange]);

  // Calculate guide positions for both orientations
  const calculateDualGuidePositions = useCallback(() => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // Camera view area (top 80% of screen)
    const cameraViewTop = 0;
    const cameraViewBottom = screenHeight * 0.8;
    const cameraViewHeight = cameraViewBottom - cameraViewTop;
    const cameraViewCenterY = cameraViewTop + (cameraViewHeight / 2) - (cameraViewHeight * 0.05);
    const cameraViewCenterX = screenWidth / 2;
    
    const margin = 50;
    const maxWidth = screenWidth - (margin * 2);
    const maxHeight = cameraViewHeight - (margin * 2);
    
    // Portrait guide (3:4 aspect ratio)
    const portraitWidth = Math.min(maxWidth * 0.8, maxHeight * 0.9);
    const portraitHeight = portraitWidth * (4/3);
    const finalPortraitWidth = portraitHeight > maxHeight ? maxHeight * (3/4) : portraitWidth;
    const finalPortraitHeight = finalPortraitWidth * (4/3);
    
    const portraitCorners: CornerPoints = {
      topLeft: { x: cameraViewCenterX - finalPortraitWidth / 2, y: cameraViewCenterY - finalPortraitHeight / 2 },
      topRight: { x: cameraViewCenterX + finalPortraitWidth / 2, y: cameraViewCenterY - finalPortraitHeight / 2 },
      bottomLeft: { x: cameraViewCenterX - finalPortraitWidth / 2, y: cameraViewCenterY + finalPortraitHeight / 2 },
      bottomRight: { x: cameraViewCenterX + finalPortraitWidth / 2, y: cameraViewCenterY + finalPortraitHeight / 2 }
    };
    
    // Landscape guide (4:3 aspect ratio)
    const landscapeWidth = Math.min(maxWidth * 0.98, maxHeight * 0.7);
    const landscapeHeight = landscapeWidth * (3/4);
    const finalLandscapeWidth = landscapeHeight > maxHeight ? maxHeight * (4/3) : landscapeWidth;
    const finalLandscapeHeight = finalLandscapeWidth * (3/4);
    
    const landscapeCorners: CornerPoints = {
      topLeft: { x: cameraViewCenterX - finalLandscapeWidth / 2, y: cameraViewCenterY - finalLandscapeHeight / 2 },
      topRight: { x: cameraViewCenterX + finalLandscapeWidth / 2, y: cameraViewCenterY - finalLandscapeHeight / 2 },
      bottomLeft: { x: cameraViewCenterX - finalLandscapeWidth / 2, y: cameraViewCenterY + finalLandscapeHeight / 2 },
      bottomRight: { x: cameraViewCenterX + finalLandscapeWidth / 2, y: cameraViewCenterY + finalLandscapeHeight / 2 }
    };
    
    return {
      portrait: portraitCorners,
      landscape: landscapeCorners
    };
  }, []);

  // Update guide positions and start detection
  const handleAlignmentCheck = useCallback(() => {
    const dualCorners = calculateDualGuidePositions();
    setDualCorners(dualCorners);
    setIsAligned(true);
    
    // Get camera stream for detection
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        cameraStreamRef.current = stream;
      })
      .catch(error => {
        console.warn('Could not access camera stream for detection:', error);
      });
  }, [calculateDualGuidePositions]);

  useEffect(() => {
    if (isVisible) {
      handleAlignmentCheck();
    }
  }, [isVisible, handleAlignmentCheck]);

  if (!isVisible || !dualCorners) return null;

  const portraitColor = '#ffffff';
  const landscapeColor = '#ffeb3b';
  const guideOpacity = isHighContrast ? 0.9 : 0.7;

  return (
    <div 
      className={`corner-guide-overlay absolute inset-0 pointer-events-none z-10 ${className}`}
      role="img"
      aria-label="Photo positioning guides for both portrait and landscape orientations"
    >
      {/* Portrait Corner Lines and Dashed Rectangle */}
      {showPortraitGuides && (
        <>
          {/* Corner lines */}
          <svg className="guide-lines portrait" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true">
            {/* Corner line implementation */}
          </svg>
          {/* Dashed rectangle */}
          <svg className="guide-lines portrait" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true">
            {/* Dashed line implementation */}
          </svg>
        </>
      )}

      {/* Landscape Corner Lines and Dashed Rectangle */}
      {showLandscapeGuides && (
        <>
          {/* Corner lines */}
          <svg className="guide-lines landscape" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true">
            {/* Corner line implementation */}
          </svg>
          {/* Dashed rectangle */}
          <svg className="guide-lines landscape" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true">
            {/* Dashed line implementation */}
          </svg>
        </>
      )}

      {/* Detection feedback */}
      {detectionState && (
        <div className="detection-feedback">
          {detectionState.portrait.hasContent && (
            <div className="portrait-detection-indicator">
              Portrait detected (confidence: {Math.round(detectionState.portrait.confidence * 100)}%)
            </div>
          )}
          {detectionState.landscape.hasContent && (
            <div className="landscape-detection-indicator">
              Landscape detected (confidence: {Math.round(detectionState.landscape.confidence * 100)}%)
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

### Task 5.9 Technical Approach:
```typescript
// Enhanced corner guide detector with real-time detection integration
export class CornerGuideDetector {
  private guideDetectionState: GuideDetectionState | null = null;
  private confidenceThreshold = 0.8;
  private orientation: 'portrait' | 'landscape' | null = null;

  setGuideDetectionState(detection: GuideDetectionState, orientation: 'portrait' | 'landscape' | null): void {
    this.guideDetectionState = detection;
    this.orientation = orientation;
  }

  async detectWithGuides(
    imageData: string,
    imageWidth: number,
    imageHeight: number
  ): Promise<DetectionResult> {
    if (!this.guideDetectionState || !this.orientation) {
      return this.getFallbackResult(imageWidth, imageHeight);
    }

    try {
      // Get the detected guide corners from real-time detection
      const guideCorners = this.getDetectedGuideCorners();
      if (!guideCorners) {
        return this.getFallbackResult(imageWidth, imageHeight);
      }

      // Convert guide corners to image coordinates
      const imageCorners = this.convertGuideToImageCoordinates(
        guideCorners,
        imageWidth,
        imageHeight
      );

      // Validate guide positioning
      if (!this.validateGuidePositioning(imageCorners, imageWidth, imageHeight)) {
        return this.getFallbackResult(imageWidth, imageHeight);
      }

      // Use guide corners as seed points for JScanify (Pass 5 - highest priority)
      const enhancedResult = await this.enhancedDetectionWithSeeds(
        imageData,
        imageCorners
      );

      // Boost confidence based on real-time detection confidence
      const boostedConfidence = this.calculateBoostedConfidence(enhancedResult.confidence);

      return {
        detected: true,
        cropArea: this.cornersToCropArea(imageCorners, imageWidth, imageHeight),
        confidence: boostedConfidence,
        method: 'guide-assisted',
        orientation: this.orientation
      };
    } catch (error) {
      console.warn('Guide-based detection failed:', error);
      return this.getFallbackResult(imageWidth, imageHeight);
    }
  }

  private getDetectedGuideCorners(): CornerPoints | null {
    if (!this.guideDetectionState || !this.orientation) return null;

    const detection = this.orientation === 'portrait' 
      ? this.guideDetectionState.portrait 
      : this.guideDetectionState.landscape;

    // Use detected corners if available, otherwise fall back to guide boundaries
    return detection.detectedCorners || null;
  }

  private calculateBoostedConfidence(baseConfidence: number): number {
    if (!this.guideDetectionState || !this.orientation) return baseConfidence;

    const detection = this.orientation === 'portrait' 
      ? this.guideDetectionState.portrait 
      : this.guideDetectionState.landscape;

    // Boost confidence based on real-time detection quality
    const detectionConfidence = detection.confidence;
    const boostFactor = Math.min(detectionConfidence * 0.3, 0.2); // Max 20% boost
    
    return Math.min(baseConfidence + boostFactor, 1.0);
  }

  private convertGuideToImageCoordinates(
    guideCorners: CornerPoints,
    imageWidth: number,
    imageHeight: number
  ): CornerPoints {
    // Convert screen coordinates to image coordinates
    // This accounts for camera preview scaling and positioning
    const scaleX = imageWidth / window.innerWidth;
    const scaleY = imageHeight / window.innerHeight;
    
    return {
      topLeft: {
        x: guideCorners.topLeft.x * scaleX,
        y: guideCorners.topLeft.y * scaleY
      },
      topRight: {
        x: guideCorners.topRight.x * scaleX,
        y: guideCorners.topRight.y * scaleY
      },
      bottomLeft: {
        x: guideCorners.bottomLeft.x * scaleX,
        y: guideCorners.bottomLeft.y * scaleY
      },
      bottomRight: {
        x: guideCorners.bottomRight.x * scaleX,
        y: guideCorners.bottomRight.y * scaleY
      }
    };
  }

  private validateGuidePositioning(
    corners: CornerPoints,
    imageWidth: number,
    imageHeight: number
  ): boolean {
    // Check if corners are within image bounds
    const allCorners = Object.values(corners);
    const margin = 50; // pixels from edge
    
    return allCorners.every(corner => 
      corner.x >= margin && corner.x <= imageWidth - margin &&
      corner.y >= margin && corner.y <= imageHeight - margin
    );
  }

  private calculateGuideConfidence(
    corners: CornerPoints,
    imageWidth: number,
    imageHeight: number
  ): number {
    // Higher confidence for properly positioned guides
    const area = this.calculateQuadrilateralArea(corners);
    const imageArea = imageWidth * imageHeight;
    const areaRatio = area / imageArea;
    
    // Optimal area ratio is 0.3-0.8 of image
    if (areaRatio >= 0.3 && areaRatio <= 0.8) {
      return 0.95; // Very high confidence for well-positioned guides
    } else if (areaRatio >= 0.2 && areaRatio <= 0.9) {
      return 0.85; // Good confidence
    } else {
      return 0.7; // Lower confidence for edge cases
    }
  }
}
```

- [x] 3. Create drag-and-drop upload interface for desktop
  - [x] 3.1 Build DragDropZone component with visual feedback
    - Create React component with drag-and-drop event handlers
    - Implement visual feedback for drag-over states
    - Add file browser fallback functionality
    - Write unit tests for drag-and-drop interactions
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 3.2 Integrate drag-and-drop with smart cropping interface
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

  - [x] 4.5 Implement dynamic aspect ratio camera layout matching native camera apps
    - Configure camera to use dynamic aspect ratio: 3:4 mobile portrait, 4:3 mobile landscape/desktop
    - Position camera view at top of screen (portrait) or left of screen (landscape)
    - Reserve remaining screen space for quality indicators and control buttons
    - Implement maximum resolution MediaDevices constraints within dynamic aspect ratio
    - Create native camera layout with dedicated control areas separate from camera view
    - Add orientation-aware repositioning with dynamic aspect ratio adjustment
    - Ensure seamless transition from camera capture to cropping interface
    - Test across multiple Android and iOS devices for consistent native camera app experience
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_

  - [ ] 4.6 Implement intelligent corner guides with real-time photo detection
    - Create CornerGuideOverlay component with dual orientation guides (portrait 3:4, landscape 4:3)
    - Position corner guides to match standard photo dimensions with proper centering in camera view
    - Implement real-time computer vision detection within each guide's 4 corners using OpenCV.js
    - Add GuideContentDetector class to analyze camera feed and detect rectangular objects within guide boundaries
    - Implement smart hiding logic: when one guide detects content, hide the other guide automatically
    - Add detection state management with confidence scoring for each guide orientation
    - Create visual feedback system showing detection status and confidence levels
    - Integrate guide detection results with smart cropper for enhanced accuracy (Pass 5 detection strategy)
    - Add accessibility features (high contrast mode, screen reader support, ARIA labels)
    - Implement responsive corner guide positioning for portrait and landscape orientations
    - Add smooth animations and transitions when guides appear/disappear based on detection
    - Write comprehensive unit tests for corner guide positioning, detection logic, and smart hiding behavior
    - Add integration tests for guide-to-smart-cropper communication and detection accuracy
    - _Requirements: 1.3, 1.6, 8.1, 8.2, 8.5, 5.9, User guidance, Smart detection enhancement, Real-time computer vision_

- [ ] 5. Build professional smart cropping with JScanify integration
  - [x] 5.0 Install JScanify dependencies and update package configuration
    - Install jscanify package (MIT license) via npm
    - Configure webpack/build system to handle OpenCV.js (~8-10MB) properly
    - Add async script loading configuration for OpenCV.js CDN
    - Update package.json with new dependencies and build scripts
    - Configure TypeScript types for jscanify and OpenCV.js integration
    - _Requirements: Dependency management, Build configuration_

  - [x] 5.1 Replace PhotoDetector with JScanify for 98%+ accuracy
    - Remove existing basic PhotoDetector service implementation
    - Install JScanify library (MIT license) and OpenCV.js dependency
    - Create SmartPhotoDetector service using JScanify for professional edge detection
    - Implement preloading strategy during app initialization to avoid capture delays
    - Add graceful fallback to generic crop area when JScanify fails to load
    - Write unit tests for JScanify integration and fallback scenarios
    - _Requirements: 8.2, 8.3, 8.4, Professional accuracy requirement_

  - [x] 5.2 Implement app initialization with OpenCV.js preloading
    - Create app-level initialization service to load OpenCV.js during startup
    - Add loading screen with progress indicator during OpenCV.js download (~8-10MB)
    - Implement initialization state management (loading/ready/fallback)
    - Add error handling for OpenCV.js loading failures with graceful degradation
    - Cache OpenCV.js in browser for instant subsequent app loads
    - _Requirements: Performance optimization, User experience_

  - [x] 5.3 Enhance QuadrilateralCropper with JScanify corner points
    - Modify existing QuadrilateralCropper to accept JScanify corner point format
    - Convert JScanify corner points to quadrilateral crop area coordinates
    - Maintain existing circular draggable corner handles for manual adjustment
    - Ensure seamless integration between automatic detection and manual refinement
    - Add confidence indicator showing detection quality to user
    - _Requirements: 8.5, 8.6, 8.7, Manual adjustment capability_

  - [x] 5.4 Integrate smart detection into camera capture flow
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

  - [x] 5.6 Enhance smart cropping accuracy with advanced preprocessing (95%+ target)
    - Create ImagePreprocessor class with CLAHE and bilateral filtering
    - Implement adaptive thresholding for variable lighting conditions
    - Add morphological operations to clean up detected edges
    - Apply edge enhancement techniques before detection
    - Test preprocessing on challenging photos (poor lighting, low contrast, glare)
    - _Requirements: 8.2, 8.3, 12.1, 12.2, 12.3, Professional accuracy requirement_
    - _See: design.md (ImagePreprocessor service) and requirements.md (Requirement 12)_
    - **✅ COMPLETED** - October 11, 2025 - All preprocessing techniques implemented, integrated into detection flow, comprehensive tests added

  - [x] 5.7 Implement multi-pass detection for robust edge finding
    - Create MultiPassDetector class running 4 detection strategies in parallel
    - Pass 1: Standard JScanify (baseline ~85% accuracy)
    - Pass 2: Enhanced preprocessing + JScanify (~90% accuracy)
    - Pass 3: Advanced contour detection (~85% accuracy)
    - Pass 4: Hough line detection for rectangular photos (~90% accuracy)
    - Implement comprehensive confidence scoring (area, rectangularity, distribution, straightness)
    - Add DetectionSelector for intelligent candidate selection with consensus algorithm
    - _Requirements: 8.2, 8.3, 8.4, 12.1, 12.4, 12.5, Professional accuracy (95-98% target)_
    - _See: design.md (MultiPassDetector service) and requirements.md (Requirement 12)_
    - **✅ COMPLETED** - October 11, 2025 - 4 detection strategies implemented, comprehensive confidence scoring, intelligent candidate selection, 95-98% expected accuracy

  - [x] 5.8 Implement adaptive detection strategy for performance optimization
    - Use quick single-pass detection for high-confidence cases (>0.85 confidence)
    - Run full multi-pass detection only for low-confidence cases (<0.85)
    - Parallel execution using Promise.allSettled (Web Worker deferred as optional optimization)
    - Implement aggressive OpenCV Mat cleanup to manage memory
    - Target: <500ms for standard photos, <1500ms for challenging photos
    - _Requirements: 12.7, 12.8, Performance, Memory optimization, Battery efficiency_
    - _See: design.md (Adaptive Strategy) and requirements.md (Requirement 12)_
    - **✅ COMPLETED** - October 11, 2025 - Adaptive strategy with quick/multi-pass paths, 29 comprehensive tests passing, integrated into JScanifyService

  - [ ] 5.9 Integrate corner guide positioning as smart detection strategy
    - Create CornerGuideDetector class to leverage user-positioned corner guides
    - Implement guide-based detection as Pass 5 in MultiPassDetector (highest priority)
    - Use corner guide coordinates as initial seed points for JScanify detection
    - Add confidence boost when detected edges align with user-placed guides
    - Implement fallback to standard detection when guides are not properly positioned
    - Create guide validation to ensure guides are within reasonable bounds
    - Add performance optimization: skip other detection passes when guide-based detection succeeds
    - Target: 98%+ accuracy for photos captured with proper guide alignment
    - _Requirements: 4.6, 5.1, 5.7, 8.2, 8.3, 12.1, 12.4, 12.5, Enhanced accuracy through user guidance_

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

- [x] 7. Build upload orchestration and progress tracking
  - [x] 7.1 Create UploadService for S3 integration
    - Implement UploadService class with presigned URL generation
    - Create chunked upload functionality for large files
    - Add upload progress tracking with percentage completion
    - Write unit tests for upload service methods
    - _Requirements: 5.1, 5.2, 5.3, 7.1, 7.2_

  - [x] 7.2 Implement upload state management and error handling
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

- [x] 10. Implement upload processing pipeline (UPDATED: Split perspective correction)
  - [x] 10.1-A Frontend perspective correction and upload preview (PRE-UPLOAD)
    - Create PerspectiveCorrectionService using OpenCV.js warpPerspective
    - Implement 4-point perspective transform from JScanify corner points
    - Build UploadPreview component showing corrected image before upload
    - Integrate preview step into CameraCaptureFlow between cropping and upload
    - Add error handling and graceful fallback to original image if correction fails
    - Optimize performance for mobile devices (<1 second processing)
    - Write unit and integration tests for perspective correction flow
    - _Requirements: 6.5, 1.6, 8.7, 8.8, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9_
    - _See: design.md (PerspectiveCorrectionService, UploadPreview) and requirements.md (Requirement 11)_
    - **✅ COMPLETED** - October 10, 2025 - All 9 acceptance criteria met, 23/23 core tests passing

  - [x] 10.1-B Backend thumbnail generation (POST-UPLOAD)
    - Update backend to receive already perspective-corrected images
    - Remove perspective correction logic from backend pipeline (now done in frontend)
    - Implement thumbnail generation for uploaded images
    - Update database schema to reflect new upload flow if needed
    - Write unit tests for thumbnail generation
    - _Requirements: 6.5, Performance, Cost optimization_
    - **✅ COMPLETED** - October 10, 2025 - Thumbnail generation implemented, gallery optimized, 95%+ performance improvement

  - [x] 10.2 Create database integration for upload tracking
    - Implement database models for photo uploads and processing jobs
    - Create API endpoints for upload status tracking
    - Add metadata storage for uploaded files (including correction method, processing time)
    - _Requirements: 7.3, 5.4, 5.5_
    - **✅ COMPLETED** - October 11, 2025 - Database models (Job, RestoreAttempt, AnimationAttempt) implemented, API endpoints for upload tracking created, metadata storage via JSON params fields

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

---

## Additional Documentation

For detailed implementation guidance, refer to:

### requirements.md
- **Requirement 11:** Upload Preview with Perspective Correction
  - Covers acceptance criteria for frontend perspective correction
  - Details user experience expectations (<1 second processing)
  - Specifies error handling and fallback requirements

- **Requirement 12:** Enhanced Smart Cropping Accuracy
  - Covers acceptance criteria for 95%+ detection accuracy
  - Details preprocessing techniques (CLAHE, bilateral filtering)
  - Specifies multi-pass detection requirements

### design.md
- **Upload Flow Architecture:** Shows updated flow with preview step
- **PerspectiveCorrectionService:** Frontend correction using OpenCV.js warpPerspective
- **UploadPreview Component:** Shows corrected image before upload
- **ImagePreprocessor:** CLAHE, bilateral filtering, morphological operations
- **MultiPassDetector:** 4 detection strategies for professional-grade accuracy
- **Architecture Decisions:** Frontend vs backend analysis and rationale
- **Implementation Priority:** Phased approach (MVP → Enhancement → Optimization)

### Key Implementation Notes

**Perspective Correction (Task 10.1-A):**
- Use OpenCV.js (already loaded for JScanify)
- Target: <1 second processing time
- Graceful fallback to original image on error
- See design.md for complete code examples

**Smart Cropping Improvements (Tasks 5.6-5.8):**
- Tier 1 (Task 5.6): Enhanced preprocessing (+15-20% accuracy)
- Tier 2 (Task 5.7): Multi-pass detection (+20-25% accuracy)
- Tier 3 (Task 5.8): Adaptive strategy (performance optimization)
- See design.md for detection strategies and confidence scoring