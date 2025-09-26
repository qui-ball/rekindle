# PWA Camera Optimization Design

## Overview

This design addresses critical PWA camera functionality issues to achieve native-app-like camera experience. The solution focuses on Docker HTTPS development environment, proper rotation handling, maximum camera quality, and comprehensive testing to determine PWA viability versus native app development.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PWA CAMERA OPTIMIZATION ARCHITECTURE                  │
└─────────────────────────────────────────────────────────────────────────────────┘

Development Environment                    PWA Camera System
┌─────────────────────────────────────┐   ┌─────────────────────────────────────┐
│                                     │   │                                     │
│  Docker HTTPS Environment           │   │  Enhanced Camera Components         │
│  ┌─────────────────────────────────┐ │   │  ┌─────────────────────────────────┐ │
│  │ • HTTPS Certificate Generation │ │   │  │ • Rotation-Aware Camera       │ │
│  │ • Local IP Detection           │ │   │  │ • Maximum Resolution Capture  │ │
│  │ • Mobile Device Access         │ │   │  │ • Native-Quality Processing   │ │
│  │ • Hot Reload Support           │ │   │  │ • Cross-Platform Compatibility│ │
│  └─────────────────────────────────┘ │   │  └─────────────────────────────────┘ │
│                                     │   │                                     │
└─────────────────────────────────────┘   └─────────────────────────────────────┘
                    │                                         │
                    └─────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              TESTING & VALIDATION LAYER                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │ Camera Quality  │  │ Rotation Tests  │  │ Performance     │                │
│  │ Benchmarking    │  │ & Orientation   │  │ Monitoring      │                │
│  │ • Resolution    │  │ • Portrait/Land │  │ • Memory Usage  │                │
│  │ • Compression   │  │ • UI Adaptation │  │ • Battery Impact│                │
│  │ • Format Tests  │  │ • Stream Handling│  │ • Responsiveness│                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Docker HTTPS Development Environment

#### Enhanced Docker Configuration
```yaml
# docker-compose.https.yml
version: '3.8'
services:
  frontend-https:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
      - "3001:3001"  # Additional port for HTTPS
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - /app/.next
      - ./frontend/certs:/app/certs  # Certificate volume
    environment:
      - CHOKIDAR_USEPOLLING=true
      - WATCHPACK_POLLING=true
      - HTTPS_ENABLED=true
      - LOCAL_IP=${LOCAL_IP}
    networks:
      - rekindle-https-network
    command: ["npm", "run", "dev:https"]

networks:
  rekindle-https-network:
    driver: bridge
```

#### Certificate Management Service
```typescript
// services/CertificateManager.ts
export class CertificateManager {
  private certPath = './certs';
  private localIP: string;

  constructor() {
    this.localIP = this.getLocalIP();
  }

  async ensureCertificates(): Promise<void> {
    const certExists = await this.checkCertificates();
    
    if (!certExists) {
      await this.generateCertificates();
    }
  }

  private async generateCertificates(): Promise<void> {
    // Use mkcert or openssl to generate certificates
    const domains = ['localhost', '127.0.0.1', this.localIP];
    
    // Generate certificates for all required domains
    await this.execCommand(`mkcert -cert-file ${this.certPath}/cert.pem -key-file ${this.certPath}/key.pem ${domains.join(' ')}`);
  }

  private getLocalIP(): string {
    const interfaces = require('os').networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const interface of interfaces[name]) {
        if (interface.family === 'IPv4' && !interface.internal) {
          return interface.address;
        }
      }
    }
    return 'localhost';
  }
}
```

### 2. Rotation-Aware Camera System

#### Enhanced Camera Component with Rotation Support
```typescript
// components/RotationAwareCamera.tsx
interface CameraState {
  orientation: 'portrait' | 'landscape';
  rotation: number;
  isFlipped: boolean;
  resolution: { width: number; height: number };
}

export class RotationAwareCamera extends React.Component<CameraCaptureProps, CameraState> {
  private orientationHandler: OrientationHandler;
  private cameraStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;

  constructor(props: CameraCaptureProps) {
    super(props);
    this.orientationHandler = new OrientationHandler();
    this.state = {
      orientation: 'portrait',
      rotation: 0,
      isFlipped: false,
      resolution: { width: 0, height: 0 }
    };
  }

  async componentDidMount() {
    await this.initializeCamera();
    this.orientationHandler.onOrientationChange(this.handleOrientationChange);
  }

  private handleOrientationChange = (orientation: DeviceOrientation) => {
    const newState = this.calculateCameraState(orientation);
    this.setState(newState);
    this.adjustCameraStream(newState);
  };

  private calculateCameraState(orientation: DeviceOrientation): Partial<CameraState> {
    // Calculate optimal camera configuration based on device orientation
    return {
      orientation: orientation.isLandscape ? 'landscape' : 'portrait',
      rotation: orientation.angle,
      isFlipped: orientation.angle === 180
    };
  }

  private async adjustCameraStream(state: Partial<CameraState>) {
    if (!this.cameraStream || !this.videoElement) return;

    // Apply CSS transforms for proper orientation
    const transform = `rotate(${state.rotation}deg) ${state.isFlipped ? 'scaleX(-1)' : ''}`;
    this.videoElement.style.transform = transform;
  }
}
```

#### Orientation Detection Service
```typescript
// services/OrientationHandler.ts
export interface DeviceOrientation {
  angle: number;
  isLandscape: boolean;
  isPortrait: boolean;
  type: 'portrait-primary' | 'portrait-secondary' | 'landscape-primary' | 'landscape-secondary';
}

export class OrientationHandler {
  private callbacks: Array<(orientation: DeviceOrientation) => void> = [];
  private currentOrientation: DeviceOrientation;

  constructor() {
    this.currentOrientation = this.getCurrentOrientation();
    this.setupEventListeners();
  }

  onOrientationChange(callback: (orientation: DeviceOrientation) => void) {
    this.callbacks.push(callback);
  }

  private setupEventListeners() {
    // Handle both orientationchange and resize events
    window.addEventListener('orientationchange', this.handleOrientationChange);
    window.addEventListener('resize', this.handleResize);
    
    // Handle screen orientation API if available
    if (screen.orientation) {
      screen.orientation.addEventListener('change', this.handleScreenOrientationChange);
    }
  }

  private handleOrientationChange = () => {
    // Delay to allow orientation to complete
    setTimeout(() => {
      const newOrientation = this.getCurrentOrientation();
      if (this.hasOrientationChanged(newOrientation)) {
        this.currentOrientation = newOrientation;
        this.notifyCallbacks(newOrientation);
      }
    }, 100);
  };

  private getCurrentOrientation(): DeviceOrientation {
    const angle = window.orientation || 0;
    const isLandscape = Math.abs(angle) === 90;
    
    return {
      angle: Math.abs(angle),
      isLandscape,
      isPortrait: !isLandscape,
      type: this.getOrientationType(angle)
    };
  }

  private getOrientationType(angle: number): DeviceOrientation['type'] {
    switch (angle) {
      case 0: return 'portrait-primary';
      case 180: case -180: return 'portrait-secondary';
      case 90: case -270: return 'landscape-primary';
      case -90: case 270: return 'landscape-secondary';
      default: return 'portrait-primary';
    }
  }
}
```

### 3. Maximum Quality Camera Capture

#### High-Resolution Camera Service
```typescript
// services/HighQualityCameraService.ts
export class HighQualityCameraService {
  private maxResolutionConstraints: MediaStreamConstraints = {
    video: {
      facingMode: 'environment',
      width: { ideal: 4096, min: 1920 },
      height: { ideal: 3072, min: 1080 },
      frameRate: { ideal: 30, min: 15 },
      // Request highest quality settings
      aspectRatio: { ideal: 4/3 },
      resizeMode: 'none',
      // Advanced constraints for supported browsers
      advanced: [
        { width: 4096, height: 3072 },
        { width: 3840, height: 2160 },
        { width: 1920, height: 1080 }
      ]
    },
    audio: false
  };

  async initializeHighQualityCamera(): Promise<MediaStream> {
    try {
      // Try maximum quality first
      return await navigator.mediaDevices.getUserMedia(this.maxResolutionConstraints);
    } catch (error) {
      console.warn('Max quality failed, trying fallback:', error);
      return await this.tryFallbackConstraints();
    }
  }

  private async tryFallbackConstraints(): Promise<MediaStream> {
    const fallbackConstraints = [
      // 4K fallback
      { video: { facingMode: 'environment', width: 3840, height: 2160 } },
      // 1080p fallback
      { video: { facingMode: 'environment', width: 1920, height: 1080 } },
      // 720p fallback
      { video: { facingMode: 'environment', width: 1280, height: 720 } },
      // Basic fallback
      { video: { facingMode: 'environment' } }
    ];

    for (const constraints of fallbackConstraints) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        console.warn('Fallback failed:', constraints, error);
      }
    }

    throw new Error('No camera constraints worked');
  }

  captureHighQualityPhoto(videoElement: HTMLVideoElement): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    // Use video's native resolution
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    // Draw at full resolution
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // Return maximum quality JPEG (0.98 quality)
    return canvas.toDataURL('image/jpeg', 0.98);
  }
}
```

### 4. PWA vs Native Comparison Framework

#### Performance Benchmarking Service
```typescript
// services/PWABenchmarkService.ts
export interface CameraBenchmarkResults {
  resolution: { achieved: string; requested: string };
  captureTime: number;
  qualityScore: number;
  memoryUsage: number;
  batteryImpact: 'low' | 'medium' | 'high';
  compatibilityScore: number;
  limitations: string[];
}

export class PWABenchmarkService {
  async runCameraBenchmark(): Promise<CameraBenchmarkResults> {
    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();

    // Test camera initialization
    const stream = await this.initializeCamera();
    const videoElement = await this.setupVideoElement(stream);

    // Measure actual resolution achieved
    const achievedResolution = {
      width: videoElement.videoWidth,
      height: videoElement.videoHeight
    };

    // Test photo capture performance
    const captureStartTime = performance.now();
    const photoData = this.capturePhoto(videoElement);
    const captureTime = performance.now() - captureStartTime;

    // Analyze photo quality
    const qualityScore = await this.analyzePhotoQuality(photoData);

    // Measure memory impact
    const endMemory = this.getMemoryUsage();
    const memoryUsage = endMemory - startMemory;

    // Test device compatibility
    const compatibilityScore = await this.testDeviceCompatibility();

    // Identify PWA limitations
    const limitations = this.identifyPWALimitations();

    return {
      resolution: {
        achieved: `${achievedResolution.width}x${achievedResolution.height}`,
        requested: '1920x1080'
      },
      captureTime,
      qualityScore,
      memoryUsage,
      batteryImpact: this.calculateBatteryImpact(memoryUsage, captureTime),
      compatibilityScore,
      limitations
    };
  }

  private identifyPWALimitations(): string[] {
    const limitations: string[] = [];

    // Check for known PWA camera limitations
    if (!navigator.mediaDevices?.getDisplayMedia) {
      limitations.push('Screen capture not available');
    }

    if (!('serviceWorker' in navigator)) {
      limitations.push('Service Worker not supported');
    }

    // Check for iOS-specific limitations
    if (this.isIOS()) {
      limitations.push('iOS: Limited to Safari browser');
      limitations.push('iOS: No background camera access');
    }

    // Check for Android limitations
    if (this.isAndroid()) {
      if (!this.isChrome()) {
        limitations.push('Android: Best experience requires Chrome');
      }
    }

    return limitations;
  }
}
```

## Data Models

### Camera Configuration Model
```typescript
interface CameraConfiguration {
  deviceId?: string;
  facingMode: 'user' | 'environment';
  resolution: {
    width: number;
    height: number;
  };
  quality: number; // 0.0 to 1.0
  format: 'jpeg' | 'png' | 'webp';
  orientation: DeviceOrientation;
  constraints: MediaStreamConstraints;
}

interface CameraCapabilities {
  maxResolution: { width: number; height: number };
  supportedFormats: string[];
  hasFlash: boolean;
  hasFocus: boolean;
  hasZoom: boolean;
  orientationSupport: boolean;
}
```

### Benchmark Data Model
```typescript
interface DeviceBenchmark {
  deviceInfo: {
    userAgent: string;
    platform: string;
    screenSize: { width: number; height: number };
    pixelRatio: number;
  };
  cameraResults: CameraBenchmarkResults;
  timestamp: Date;
  testVersion: string;
}
```

## Error Handling

### Comprehensive Error Management
```typescript
// services/CameraErrorHandler.ts
export enum CameraErrorType {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  CONSTRAINT_NOT_SATISFIED = 'CONSTRAINT_NOT_SATISFIED',
  ORIENTATION_FAILED = 'ORIENTATION_FAILED',
  CAPTURE_FAILED = 'CAPTURE_FAILED',
  QUALITY_DEGRADED = 'QUALITY_DEGRADED'
}

export class CameraErrorHandler {
  handleCameraError(error: Error, context: string): CameraError {
    if (error.name === 'NotAllowedError') {
      return this.createPermissionError();
    }
    
    if (error.name === 'OverconstrainedError') {
      return this.createConstraintError(error as OverconstrainedError);
    }
    
    if (error.name === 'NotFoundError') {
      return this.createDeviceError();
    }
    
    return this.createGenericError(error, context);
  }

  private createPermissionError(): CameraError {
    return {
      type: CameraErrorType.PERMISSION_DENIED,
      message: 'Camera permission denied. Please allow camera access and try again.',
      recovery: [
        'Click the camera icon in your browser address bar',
        'Select "Allow" for camera permission',
        'Refresh the page and try again'
      ]
    };
  }

  private createConstraintError(error: OverconstrainedError): CameraError {
    return {
      type: CameraErrorType.CONSTRAINT_NOT_SATISFIED,
      message: `Camera constraint not supported: ${error.constraint}`,
      recovery: [
        'Your device camera may not support the requested quality',
        'The app will automatically try lower quality settings',
        'If issues persist, try restarting your browser'
      ]
    };
  }
}
```

## Testing Strategy

### Automated Camera Testing
```typescript
// tests/CameraTestSuite.ts
export class CameraTestSuite {
  async runFullCameraTests(): Promise<TestResults> {
    const results: TestResults = {
      orientation: await this.testOrientationHandling(),
      quality: await this.testCameraQuality(),
      performance: await this.testPerformance(),
      compatibility: await this.testCrossDeviceCompatibility(),
      docker: await this.testDockerHTTPS()
    };

    return results;
  }

  private async testOrientationHandling(): Promise<OrientationTestResults> {
    // Test rotation in all orientations
    const orientations = [0, 90, 180, 270];
    const results = [];

    for (const angle of orientations) {
      // Simulate orientation change
      const result = await this.simulateOrientationChange(angle);
      results.push(result);
    }

    return {
      allOrientationsSupported: results.every(r => r.success),
      uiAdaptation: results.every(r => r.uiAdapted),
      streamMaintained: results.every(r => r.streamMaintained)
    };
  }

  private async testCameraQuality(): Promise<QualityTestResults> {
    const camera = new HighQualityCameraService();
    const stream = await camera.initializeHighQualityCamera();
    
    // Measure achieved resolution
    const video = document.createElement('video');
    video.srcObject = stream;
    await new Promise(resolve => video.onloadedmetadata = resolve);

    const achievedResolution = {
      width: video.videoWidth,
      height: video.videoHeight
    };

    // Capture and analyze photo quality
    const photoData = camera.captureHighQualityPhoto(video);
    const qualityMetrics = await this.analyzeImageQuality(photoData);

    return {
      achievedResolution,
      qualityMetrics,
      meetsRequirements: achievedResolution.height >= 1080
    };
  }
}
```

This design provides a comprehensive solution to all the PWA camera issues you've identified, with proper Docker HTTPS support, rotation handling, maximum quality capture, and thorough testing to determine PWA viability versus native app development.