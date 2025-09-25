/**
 * Format-Specific Conversion Service
 * Handles conversion and optimization of different image formats using dedicated libraries
 * - HEIC files: Uses heic2any library for HEIC → JPEG conversion
 * - PNG/JPEG/WebP files: Uses browser-image-compression for optimization and standardization
 */

import heic2any from 'heic2any';
import imageCompression from 'browser-image-compression';

export interface ConversionOptions {
  quality?: number;
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  preserveExif?: boolean;
}

export interface ConversionResult {
  file: File;
  originalFormat: string;
  convertedFormat: string;
  originalSize: number;
  convertedSize: number;
  compressionRatio: number;
}

export interface FormatDetectionResult {
  format: 'heic' | 'jpeg' | 'png' | 'webp' | 'unknown';
  needsConversion: boolean;
  recommendedAction: 'convert' | 'optimize' | 'none';
}

export class FormatConverter {
  private readonly defaultOptions: Required<ConversionOptions> = {
    quality: 0.92, // High quality for AI processing
    maxSizeMB: 50, // Respect upload limit
    maxWidthOrHeight: 8000, // Respect dimension limits
    useWebWorker: true,
    preserveExif: false // Remove EXIF for privacy
  };

  /**
   * Main conversion method that routes to appropriate converter based on format
   */
  async convertToOptimalFormat(
    file: File, 
    options: Partial<ConversionOptions> = {}
  ): Promise<ConversionResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const detection = this.detectFileFormat(file);
    
    const originalSize = file.size;
    let convertedFile: File;
    let convertedFormat: string;

    switch (detection.format) {
      case 'heic':
        convertedFile = await this.convertHeicToJpeg(file, mergedOptions);
        convertedFormat = 'image/jpeg';
        break;
      
      case 'png':
      case 'jpeg':
      case 'webp':
        convertedFile = await this.optimizeStandardFormat(file, mergedOptions);
        convertedFormat = 'image/jpeg'; // Standardize to JPEG for AI processing
        break;
      
      default:
        throw new Error(`Unsupported format: ${detection.format}`);
    }

    const compressionRatio = originalSize > 0 ? convertedFile.size / originalSize : 1;

    return {
      file: convertedFile,
      originalFormat: file.type,
      convertedFormat,
      originalSize,
      convertedSize: convertedFile.size,
      compressionRatio
    };
  }

  /**
   * Detects file format and determines conversion needs
   */
  detectFileFormat(file: File): FormatDetectionResult {
    const mimeType = file.type.toLowerCase();
    const extension = this.getFileExtension(file.name).toLowerCase();
    
    // HEIC detection
    if (mimeType === 'image/heic' || extension === '.heic') {
      return {
        format: 'heic',
        needsConversion: true,
        recommendedAction: 'convert'
      };
    }
    
    // JPEG detection
    if (mimeType === 'image/jpeg' || ['.jpg', '.jpeg'].includes(extension)) {
      return {
        format: 'jpeg',
        needsConversion: false,
        recommendedAction: 'optimize'
      };
    }
    
    // PNG detection
    if (mimeType === 'image/png' || extension === '.png') {
      return {
        format: 'png',
        needsConversion: false,
        recommendedAction: 'optimize'
      };
    }
    
    // WebP detection
    if (mimeType === 'image/webp' || extension === '.webp') {
      return {
        format: 'webp',
        needsConversion: false,
        recommendedAction: 'optimize'
      };
    }
    
    return {
      format: 'unknown',
      needsConversion: false,
      recommendedAction: 'none'
    };
  }

  /**
   * Converts HEIC files to JPEG using heic2any library
   */
  private async convertHeicToJpeg(
    file: File, 
    options: Required<ConversionOptions>
  ): Promise<File> {
    try {
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: options.quality
        // Note: multiple property omitted as it defaults to undefined (single file output)
      }) as Blob;

      // Create new file with JPEG extension
      const newFileName = file.name.replace(/\.heic$/i, '.jpg');
      
      const convertedFile = new File([convertedBlob], newFileName, {
        type: 'image/jpeg',
        lastModified: file.lastModified
      });
      
      // Ensure lastModified is properly set (workaround for some environments)
      Object.defineProperty(convertedFile, 'lastModified', {
        value: file.lastModified,
        writable: false,
        configurable: true
      });
      
      return convertedFile;
    } catch (error) {
      throw new Error(`HEIC conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Optimizes standard formats (PNG/JPEG/WebP) using browser-image-compression
   */
  private async optimizeStandardFormat(
    file: File, 
    options: Required<ConversionOptions>
  ): Promise<File> {
    try {
      const compressionOptions = {
        maxSizeMB: options.maxSizeMB,
        maxWidthOrHeight: options.maxWidthOrHeight,
        useWebWorker: options.useWebWorker,
        fileType: 'image/jpeg', // Standardize to JPEG for AI processing
        quality: options.quality,
        preserveExif: options.preserveExif,
        // Additional options for better quality
        alwaysKeepResolution: false,
        exifOrientation: 1 // Reset orientation
      };

      const compressedFile = await imageCompression(file, compressionOptions);
      
      // Ensure proper filename extension
      const newFileName = this.ensureJpegExtension(compressedFile.name);
      
      const convertedFile = new File([compressedFile], newFileName, {
        type: 'image/jpeg',
        lastModified: file.lastModified
      });
      
      // Ensure lastModified is properly set (workaround for some environments)
      Object.defineProperty(convertedFile, 'lastModified', {
        value: file.lastModified,
        writable: false,
        configurable: true
      });
      
      return convertedFile;
    } catch (error) {
      throw new Error(`Format optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batch conversion for multiple files
   */
  async convertMultipleFiles(
    files: File[], 
    options: Partial<ConversionOptions> = {}
  ): Promise<ConversionResult[]> {
    const results: ConversionResult[] = [];
    
    for (const file of files) {
      try {
        const result = await this.convertToOptimalFormat(file, options);
        results.push(result);
      } catch (error) {
        // Continue with other files even if one fails
        console.error(`Failed to convert ${file.name}:`, error);
        // Add failed result
        results.push({
          file,
          originalFormat: file.type,
          convertedFormat: file.type,
          originalSize: file.size,
          convertedSize: file.size,
          compressionRatio: 1
        });
      }
    }
    
    return results;
  }

  /**
   * Validates if a file format is supported for conversion
   */
  isFormatSupported(file: File): boolean {
    const detection = this.detectFileFormat(file);
    return detection.format !== 'unknown';
  }

  /**
   * Gets conversion statistics for a file without actually converting
   */
  async getConversionPreview(file: File): Promise<{
    willConvert: boolean;
    estimatedSize: number;
    targetFormat: string;
    processingTime: number; // estimated in seconds
  }> {
    const detection = this.detectFileFormat(file);
    
    let estimatedSize = file.size;
    let processingTime = 2; // base processing time
    
    if (detection.format === 'heic') {
      // HEIC conversion typically reduces size by 20-40%
      estimatedSize = Math.round(file.size * 0.7);
      processingTime = 5; // HEIC conversion takes longer
    } else if (['png', 'webp'].includes(detection.format)) {
      // PNG/WebP to JPEG conversion varies widely
      estimatedSize = Math.round(file.size * 0.8);
      processingTime = 3;
    }
    
    // Adjust for large files
    if (file.size > 10 * 1024 * 1024) { // > 10MB
      processingTime *= 1.5;
    }
    
    return {
      willConvert: detection.needsConversion || detection.recommendedAction === 'optimize',
      estimatedSize,
      targetFormat: 'image/jpeg',
      processingTime
    };
  }

  // Private helper methods

  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex === -1 ? '' : filename.substring(lastDotIndex);
  }

  private ensureJpegExtension(filename: string): string {
    const extension = this.getFileExtension(filename).toLowerCase();
    
    if (['.jpg', '.jpeg'].includes(extension)) {
      return filename;
    }
    
    // Replace extension with .jpg
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
    return `${nameWithoutExt}.jpg`;
  }
}

// Export singleton instance
export const formatConverter = new FormatConverter();

// Export factory function for custom options
export const createFormatConverter = () => new FormatConverter();