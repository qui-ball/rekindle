/**
 * Format Converter Usage Examples
 * Demonstrates how to use the FormatConverter for different file types
 */

import { formatConverter, FormatConverter } from '../formatConverter';

/**
 * Example: Convert a HEIC file to JPEG
 */
export async function convertHeicExample(heicFile: File) {
  try {
    // Check if the format is supported
    if (!formatConverter.isFormatSupported(heicFile)) {
      throw new Error('File format not supported');
    }

    // Get conversion preview
    const preview = await formatConverter.getConversionPreview(heicFile);
    console.log('Conversion preview:', {
      willConvert: preview.willConvert,
      estimatedSize: `${Math.round(preview.estimatedSize / 1024)}KB`,
      targetFormat: preview.targetFormat,
      processingTime: `${preview.processingTime}s`
    });

    // Perform the conversion
    const result = await formatConverter.convertToOptimalFormat(heicFile);
    
    console.log('Conversion completed:', {
      originalFormat: result.originalFormat,
      convertedFormat: result.convertedFormat,
      originalSize: `${Math.round(result.originalSize / 1024)}KB`,
      convertedSize: `${Math.round(result.convertedSize / 1024)}KB`,
      compressionRatio: `${Math.round(result.compressionRatio * 100)}%`
    });

    return result.file;
  } catch (error) {
    console.error('HEIC conversion failed:', error);
    throw error;
  }
}

/**
 * Example: Optimize a PNG file for AI processing
 */
export async function optimizePngExample(pngFile: File) {
  try {
    const result = await formatConverter.convertToOptimalFormat(pngFile, {
      quality: 0.9, // High quality for AI processing
      maxSizeMB: 25, // Smaller size limit
      preserveExif: false // Remove metadata for privacy
    });

    console.log('PNG optimization completed:', {
      originalFormat: result.originalFormat,
      convertedFormat: result.convertedFormat,
      sizeSaved: `${Math.round((result.originalSize - result.convertedSize) / 1024)}KB`
    });

    return result.file;
  } catch (error) {
    console.error('PNG optimization failed:', error);
    throw error;
  }
}

/**
 * Example: Batch convert multiple files
 */
export async function batchConvertExample(files: File[]) {
  try {
    console.log(`Starting batch conversion of ${files.length} files...`);
    
    const results = await formatConverter.convertMultipleFiles(files, {
      quality: 0.92,
      maxSizeMB: 50,
      useWebWorker: true
    });

    const successful = results.filter(r => r.compressionRatio < 1);
    const failed = results.filter(r => r.compressionRatio === 1);

    console.log('Batch conversion completed:', {
      total: files.length,
      successful: successful.length,
      failed: failed.length,
      totalSizeSaved: `${Math.round(
        successful.reduce((acc, r) => acc + (r.originalSize - r.convertedSize), 0) / 1024
      )}KB`
    });

    return results.map(r => r.file);
  } catch (error) {
    console.error('Batch conversion failed:', error);
    throw error;
  }
}

/**
 * Example: Format detection and routing
 */
export function detectFormatExample(file: File) {
  const detection = formatConverter.detectFileFormat(file);
  
  console.log('Format detection result:', {
    filename: file.name,
    detectedFormat: detection.format,
    needsConversion: detection.needsConversion,
    recommendedAction: detection.recommendedAction
  });

  // Route to appropriate handler based on format
  switch (detection.format) {
    case 'heic':
      console.log('→ Will convert HEIC to JPEG using heic2any library');
      break;
    case 'png':
      console.log('→ Will optimize PNG and convert to JPEG using browser-image-compression');
      break;
    case 'jpeg':
      console.log('→ Will optimize JPEG using browser-image-compression');
      break;
    case 'webp':
      console.log('→ Will convert WebP to JPEG using browser-image-compression');
      break;
    default:
      console.log('→ Format not supported for conversion');
  }

  return detection;
}

/**
 * Example: Custom converter with specific settings
 */
export function createCustomConverterExample() {
  const customConverter = new FormatConverter();
  
  // Example: High-quality conversion for professional use
  const professionalOptions = {
    quality: 0.95,
    maxSizeMB: 100,
    maxWidthOrHeight: 10000,
    useWebWorker: true,
    preserveExif: true // Keep metadata for professional use
  };

  // Example: Fast conversion for preview generation
  const previewOptions = {
    quality: 0.7,
    maxSizeMB: 5,
    maxWidthOrHeight: 1920,
    useWebWorker: false,
    preserveExif: false
  };

  return {
    convertForProfessional: (file: File) => 
      customConverter.convertToOptimalFormat(file, professionalOptions),
    convertForPreview: (file: File) => 
      customConverter.convertToOptimalFormat(file, previewOptions)
  };
}

/**
 * Example: Error handling and recovery
 */
export async function robustConversionExample(file: File) {
  try {
    // First, check if format is supported
    if (!formatConverter.isFormatSupported(file)) {
      throw new Error(`Unsupported format: ${file.type}`);
    }

    // Try conversion with default settings
    return await formatConverter.convertToOptimalFormat(file);
    
  } catch (error) {
    console.warn('Default conversion failed, trying with fallback settings:', error);
    
    try {
      // Fallback: Try with more lenient settings
      return await formatConverter.convertToOptimalFormat(file, {
        quality: 0.8,
        maxSizeMB: 100,
        useWebWorker: false // Disable web worker in case of issues
      });
    } catch (fallbackError) {
      console.error('All conversion attempts failed:', fallbackError);
      
      // Final fallback: Return original file if all else fails
      console.log('Returning original file as final fallback');
      return file;
    }
  }
}