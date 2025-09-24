import { useState, useCallback, useMemo } from 'react';
import { ValidationResult, FileValidationRules } from '../types/upload';

/**
 * Custom hook for file validation
 * Provides file validation with configurable rules
 */
export const useFileValidation = (rules?: Partial<FileValidationRules>) => {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const defaultRules = useMemo((): FileValidationRules => ({
    maxSize: 50 * 1024 * 1024, // 50MB
    minDimensions: { width: 200, height: 200 },
    maxDimensions: { width: 8000, height: 8000 },
    allowedTypes: ['image/jpeg', 'image/png', 'image/heic', 'image/webp'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.heic', '.webp'],
    ...rules
  }), [rules]);

  const validateFile = useCallback(async (file: File): Promise<ValidationResult> => {
    // Implementation will be added in task 2.1
    // This is a placeholder that will be replaced with actual validation logic
    
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Basic size validation for now
    if (file.size > defaultRules.maxSize) {
      result.valid = false;
      result.errors.push({
        code: 'file_too_large',
        message: `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(defaultRules.maxSize / 1024 / 1024)}MB)`
      });
    }

    // Basic type validation for now
    if (!defaultRules.allowedTypes.includes(file.type)) {
      result.valid = false;
      result.errors.push({
        code: 'unsupported_format',
        message: `File type ${file.type} is not supported`
      });
    }

    setValidationResult(result);
    return result;
  }, [defaultRules]);

  const clearValidation = useCallback(() => {
    setValidationResult(null);
  }, []);

  return {
    validationResult,
    validateFile,
    clearValidation,
    validationRules: defaultRules
  };
};