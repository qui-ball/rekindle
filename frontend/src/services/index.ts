// Service layer exports
export * from './uploadService';
export * from './fileProcessor';
export * from './cropProcessor';
export * from './fileValidator';
export * from './formatConverter';

// Smart photo detection services
export { SmartPhotoDetector } from './SmartPhotoDetector';
export { jscanifyService, JScanifyService } from './jscanifyService';
export { opencvLoader, OpenCVLoader } from './opencvLoader';
export { appInitialization, AppInitializationService } from './appInitialization';
export { imagePreprocessor, ImagePreprocessor } from './ImagePreprocessor';

// Multi-pass detection services (Tasks 5.7 & 5.8)
export { MultiPassDetector } from './MultiPassDetector';
export { AdaptiveDetectionStrategy } from './AdaptiveDetectionStrategy';
export * from './ConfidenceScoring';

// Perspective correction service
export { perspectiveCorrectionService, PerspectiveCorrectionService } from './perspectiveCorrectionService';