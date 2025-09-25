/**
 * File Validation Service
 * Handles file type, size, and dimension validation for photo uploads
 * Supports HEIC to JPEG conversion for iOS compatibility
 */

import { 
  FileValidationRules, 
  ValidationResult, 
  ValidationError, 
  ValidationWarning,
  ErrorType,
  UploadError 
} from '../types/upload';

export class FileValidator {
  private readonly rules: FileValidationRules;

  constructor(customRules?: Partial<FileValidationRules>) {
    this.rules = {
      maxSize: 50 * 1024 * 1024, // 50MB
      minDimensions: { width: 200, height: 200 },
      maxDimensions: { width: 8000, height: 8000 },
      allowedTypes: ['image/jpeg', 'image/png', 'image/heic', 'image/webp'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.heic', '.webp'],
      ...customRules
    };
  }

  /**
   * Validates a file against all validation rules
   */
  async validateFile(file: File): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // File type validation
    const typeValidation = this.validateFileType(file);
    if (!typeValidation.valid) {
      errors.push(...typeValidation.errors);
    }

    // File size validation
    const sizeValidation = this.validateFileSize(file);
    if (!sizeValidation.valid) {
      errors.push(...sizeValidation.errors);
    }
    warnings.push(...sizeValidation.warnings);

    // Dimension validation (requires loading the image)
    try {
      const dimensionValidation = await this.validateDimensions(file);
      if (!dimensionValidation.valid) {
        errors.push(...dimensionValidation.errors);
      }
      warnings.push(...dimensionValidation.warnings);
    } catch {
      errors.push({
        code: 'DIMENSION_CHECK_FAILED',
        message: 'Unable to read image dimensions. File may be corrupted.',
        field: 'dimensions'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates file type and extension
   */
  validateFileType(file: File): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check MIME type
    if (!this.rules.allowedTypes.includes(file.type)) {
      errors.push({
        code: 'INVALID_FILE_TYPE',
        message: `File type "${file.type}" is not supported. Please use JPG, PNG, HEIC, or WebP format.`,
        field: 'type'
      });
    }

    // Check file extension
    const extension = this.getFileExtension(file.name).toLowerCase();
    if (!this.rules.allowedExtensions.includes(extension)) {
      errors.push({
        code: 'INVALID_FILE_EXTENSION',
        message: `File extension "${extension}" is not supported. Please use .jpg, .png, .heic, or .webp files.`,
        field: 'extension'
      });
    }

    // Special handling for HEIC files
    if (file.type === 'image/heic' || extension === '.heic') {
      warnings.push({
        code: 'HEIC_CONVERSION_REQUIRED',
        message: 'HEIC file will be automatically converted to JPEG for processing.',
        field: 'type'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates file size
   */
  validateFileSize(file: File): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (file.size > this.rules.maxSize) {
      errors.push({
        code: 'FILE_TOO_LARGE',
        message: `File size (${this.formatFileSize(file.size)}) exceeds the maximum limit of ${this.formatFileSize(this.rules.maxSize)}.`,
        field: 'size'
      });
    }

    // Warning for very large files that might be slow to process
    const warningThreshold = this.rules.maxSize * 0.8; // 80% of max size
    if (file.size > warningThreshold) {
      warnings.push({
        code: 'LARGE_FILE_WARNING',
        message: `Large file (${this.formatFileSize(file.size)}) may take longer to upload and process.`,
        field: 'size'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates image dimensions
   */
  async validateDimensions(file: File): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      const dimensions = await this.getImageDimensions(file);

      // Check minimum dimensions
      if (dimensions.width < this.rules.minDimensions.width || 
          dimensions.height < this.rules.minDimensions.height) {
        errors.push({
          code: 'DIMENSIONS_TOO_SMALL',
          message: `Image dimensions (${dimensions.width}x${dimensions.height}) are too small. Minimum required: ${this.rules.minDimensions.width}x${this.rules.minDimensions.height}.`,
          field: 'dimensions'
        });
      }

      // Check maximum dimensions
      if (dimensions.width > this.rules.maxDimensions.width || 
          dimensions.height > this.rules.maxDimensions.height) {
        errors.push({
          code: 'DIMENSIONS_TOO_LARGE',
          message: `Image dimensions (${dimensions.width}x${dimensions.height}) are too large. Maximum allowed: ${this.rules.maxDimensions.width}x${this.rules.maxDimensions.height}.`,
          field: 'dimensions'
        });
      }

      // Warning for very small images that might have quality issues
      const qualityWarningThreshold = Math.max(this.rules.minDimensions.width * 2, 400);
      if (dimensions.width < qualityWarningThreshold || dimensions.height < qualityWarningThreshold) {
        warnings.push({
          code: 'LOW_RESOLUTION_WARNING',
          message: `Image resolution (${dimensions.width}x${dimensions.height}) is quite low and may affect restoration quality.`,
          field: 'dimensions'
        });
      }

    } catch (error) {
      throw new Error(`Failed to read image dimensions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Converts HEIC file to JPEG format using dedicated library
   * @deprecated Use FormatConverter.convertToOptimalFormat() instead
   */
  async convertHeicToJpeg(file: File): Promise<File> {
    if (file.type !== 'image/heic' && !file.name.toLowerCase().endsWith('.heic')) {
      throw new Error('File is not a HEIC format');
    }

    // Import FormatConverter dynamically to avoid circular dependencies
    const { formatConverter } = await import('./formatConverter');
    
    try {
      const result = await formatConverter.convertToOptimalFormat(file);
      return result.file;
    } catch (error) {
      throw new Error(`HEIC conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Checks if a file needs HEIC conversion
   */
  needsHeicConversion(file: File): boolean {
    return file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic');
  }

  /**
   * Creates an UploadError from validation results
   */
  createValidationError(validationResult: ValidationResult): UploadError {
    const primaryError = validationResult.errors[0];
    const error = new Error(primaryError?.message || 'File validation failed') as UploadError;
    
    error.code = primaryError?.code || 'VALIDATION_FAILED';
    error.type = ErrorType.VALIDATION_ERROR;
    error.retryable = false;
    error.details = {
      errors: validationResult.errors,
      warnings: validationResult.warnings
    };
    
    return error;
  }

  // Private helper methods

  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex === -1 ? '' : filename.substring(lastDotIndex);
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private async getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      
      img.src = URL.createObjectURL(file);
    });
  }


}

// Export a default instance with standard rules
export const fileValidator = new FileValidator();

// Export factory function for custom validation rules
export const createFileValidator = (customRules?: Partial<FileValidationRules>) => {
  return new FileValidator(customRules);
};