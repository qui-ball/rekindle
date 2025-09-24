import { CropAreaPixels, EdgeDetectionResult, CropSuggestion } from '../types/upload';

/**
 * Cropping operations and coordinate transformations service
 * Handles image cropping, edge detection, and perspective correction
 */
export interface CropProcessor {
  applyCrop(imageData: string, cropArea: CropAreaPixels): Promise<string>;
  detectEdges(imageData: string): Promise<EdgeDetectionResult>;
  suggestCrop(imageData: string): Promise<CropSuggestion>;
  correctPerspective(imageData: string): Promise<string>;
}

/**
 * Implementation of CropProcessor
 * Provides image cropping and enhancement capabilities
 */
export class ImageCropProcessor implements CropProcessor {
  async applyCrop(_imageData: string, _cropArea: CropAreaPixels): Promise<string> {
    // Implementation will be added in task 5.2
    throw new Error('Not implemented yet');
  }

  async detectEdges(_imageData: string): Promise<EdgeDetectionResult> {
    // Implementation will be added in task 4.2
    throw new Error('Not implemented yet');
  }

  async suggestCrop(_imageData: string): Promise<CropSuggestion> {
    // Implementation will be added in task 5.1
    throw new Error('Not implemented yet');
  }

  async correctPerspective(_imageData: string): Promise<string> {
    // Implementation will be added in task 10.1
    throw new Error('Not implemented yet');
  }
}