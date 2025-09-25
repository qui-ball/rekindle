/**
 * Unit tests for FileValidator service
 * Tests file type, size, and dimension validation
 * Tests HEIC to JPEG conversion functionality
 */

import { FileValidator, fileValidator, createFileValidator } from '../fileValidator';
import { ErrorType } from '../../types/upload';

// Mock DOM APIs that aren't available in Jest environment
const mockCreateElement = jest.fn();
const mockGetContext = jest.fn();
const mockToBlob = jest.fn();
const mockDrawImage = jest.fn();

// Mock Image constructor
let mockImageDimensions = { width: 1920, height: 1080 };

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src: string = '';
  naturalWidth: number = 0;
  naturalHeight: number = 0;
  width: number = 0;
  height: number = 0;

  constructor() {
    // Set dimensions from the mock state
    this.naturalWidth = mockImageDimensions.width;
    this.naturalHeight = mockImageDimensions.height;
    this.width = mockImageDimensions.width;
    this.height = mockImageDimensions.height;
    
    // Simulate image loading
    setTimeout(() => {
      if (this.onload) {
        this.onload();
      }
    }, 0);
  }
}

// Mock FileReader
class MockFileReader {
  onload: ((event: unknown) => void) | null = null;
  onerror: (() => void) | null = null;
  result: string | ArrayBuffer | null = null;

  readAsDataURL(file: File) {
    setTimeout(() => {
      this.result = `data:${file.type};base64,mockbase64data`;
      if (this.onload) {
        this.onload({ target: { result: this.result } });
      }
    }, 0);
  }
}

// Mock URL.createObjectURL
const mockCreateObjectURL = jest.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = jest.fn();

// Setup mocks
beforeAll(() => {
  global.Image = MockImage as unknown as typeof Image;
  global.FileReader = MockFileReader as unknown as typeof FileReader;
  global.URL = {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL
  } as unknown as typeof URL;

  Object.defineProperty(document, 'createElement', {
    value: mockCreateElement.mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          getContext: mockGetContext.mockReturnValue({
            drawImage: mockDrawImage
          }),
          toBlob: mockToBlob,
          width: 0,
          height: 0
        };
      }
      return {};
    })
  });
});

// Helper function to create mock files
const createMockFile = (
  name: string,
  type: string,
  size: number,
  _width: number = 1920,
  _height: number = 1080
): File => {
  const file = new File(['mock content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  
  return file;
};

// Helper function to set mock image dimensions
const setMockImageDimensions = (width: number, height: number) => {
  mockImageDimensions = { width, height };
};

describe('FileValidator', () => {
  let validator: FileValidator;

  beforeEach(() => {
    validator = new FileValidator();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should use default validation rules', () => {
      const defaultValidator = new FileValidator();
      expect(defaultValidator).toBeInstanceOf(FileValidator);
    });

    it('should accept custom validation rules', () => {
      const customValidator = createFileValidator({
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['image/jpeg']
      });
      expect(customValidator).toBeInstanceOf(FileValidator);
    });
  });

  describe('validateFileType', () => {
    it('should accept valid JPEG file', () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      const result = validator.validateFileType(file);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept valid PNG file', () => {
      const file = createMockFile('test.png', 'image/png', 1024);
      const result = validator.validateFileType(file);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept valid WebP file', () => {
      const file = createMockFile('test.webp', 'image/webp', 1024);
      const result = validator.validateFileType(file);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept HEIC file with conversion warning', () => {
      const file = createMockFile('test.heic', 'image/heic', 1024);
      const result = validator.validateFileType(file);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('HEIC_CONVERSION_REQUIRED');
    });

    it('should reject invalid file type', () => {
      const file = createMockFile('test.pdf', 'application/pdf', 1024);
      const result = validator.validateFileType(file);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2); // Both MIME type and extension errors
      expect(result.errors[0].code).toBe('INVALID_FILE_TYPE');
      expect(result.errors[1].code).toBe('INVALID_FILE_EXTENSION');
    });

    it('should reject file with invalid extension but valid MIME type', () => {
      const file = createMockFile('test.txt', 'image/jpeg', 1024);
      const result = validator.validateFileType(file);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_FILE_EXTENSION');
    });

    it('should handle files without extensions', () => {
      const file = createMockFile('test', 'image/jpeg', 1024);
      const result = validator.validateFileType(file);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_FILE_EXTENSION');
    });
  });

  describe('validateFileSize', () => {
    it('should accept file within size limit', () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 10 * 1024 * 1024); // 10MB
      const result = validator.validateFileSize(file);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject file exceeding size limit', () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 60 * 1024 * 1024); // 60MB
      const result = validator.validateFileSize(file);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('FILE_TOO_LARGE');
      expect(result.errors[0].message).toContain('60 MB');
      expect(result.errors[0].message).toContain('50 MB');
    });

    it('should warn about large files', () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 45 * 1024 * 1024); // 45MB (90% of limit)
      const result = validator.validateFileSize(file);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('LARGE_FILE_WARNING');
    });

    it('should format file sizes correctly', () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 60 * 1024 * 1024);
      const result = validator.validateFileSize(file);
      
      expect(result.errors[0].message).toContain('60 MB');
    });
  });

  describe('validateDimensions', () => {
    it('should accept valid dimensions', async () => {
      setMockImageDimensions(1920, 1080);
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      const result = await validator.validateDimensions(file);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject dimensions that are too small', async () => {
      setMockImageDimensions(100, 100);
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      const result = await validator.validateDimensions(file);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('DIMENSIONS_TOO_SMALL');
      expect(result.errors[0].message).toContain('100x100');
      expect(result.errors[0].message).toContain('200x200');
    });

    it('should reject dimensions that are too large', async () => {
      setMockImageDimensions(10000, 10000);
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      const result = await validator.validateDimensions(file);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('DIMENSIONS_TOO_LARGE');
      expect(result.errors[0].message).toContain('10000x10000');
      expect(result.errors[0].message).toContain('8000x8000');
    });

    it('should warn about low resolution images', async () => {
      setMockImageDimensions(300, 300);
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      const result = await validator.validateDimensions(file);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('LOW_RESOLUTION_WARNING');
    });

    it('should handle image loading errors', async () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      
      // Create a new MockImage class that fails to load
      const FailingMockImage = class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src: string = '';
        
        constructor() {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror();
            }
          }, 0);
        }
      };
      
      // Temporarily replace the global Image
      const originalImage = global.Image;
      global.Image = FailingMockImage as unknown as typeof Image;
      
      await expect(validator.validateDimensions(file)).rejects.toThrow('Failed to read image dimensions');
      
      // Restore original Image
      global.Image = originalImage;
    });
  });

  describe('validateFile', () => {
    it('should validate all aspects of a valid file', async () => {
      setMockImageDimensions(1920, 1080);
      const file = createMockFile('test.jpg', 'image/jpeg', 10 * 1024 * 1024);
      const result = await validator.validateFile(file);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect all validation errors', async () => {
      setMockImageDimensions(100, 100);
      const file = createMockFile('test.pdf', 'application/pdf', 60 * 1024 * 1024);
      const result = await validator.validateFile(file);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      
      const errorCodes = result.errors.map(e => e.code);
      expect(errorCodes).toContain('INVALID_FILE_TYPE');
      expect(errorCodes).toContain('FILE_TOO_LARGE');
      expect(errorCodes).toContain('DIMENSIONS_TOO_SMALL');
    });

    it('should handle dimension validation errors gracefully', async () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      
      // Mock dimension validation failure
      jest.spyOn(validator, 'validateDimensions').mockRejectedValue(new Error('Dimension check failed'));
      
      const result = await validator.validateFile(file);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'DIMENSION_CHECK_FAILED')).toBe(true);
    });
  });

  describe('HEIC conversion', () => {
    // Mock the formatConverter module at the top level
    const mockFormatConverter = {
      convertToOptimalFormat: jest.fn()
    };

    beforeEach(() => {
      // Reset mocks before each test
      jest.clearAllMocks();
      mockFormatConverter.convertToOptimalFormat.mockReset();
      
      // Mock the module using Jest's module mocking
      jest.mock('../formatConverter', () => ({
        formatConverter: mockFormatConverter
      }));
    });

    afterEach(() => {
      // Clean up mocks after each test
      jest.unmock('../formatConverter');
    });

    it('should detect HEIC files that need conversion', () => {
      const heicFile = createMockFile('test.heic', 'image/heic', 1024);
      expect(validator.needsHeicConversion(heicFile)).toBe(true);
      
      const jpegFile = createMockFile('test.jpg', 'image/jpeg', 1024);
      expect(validator.needsHeicConversion(jpegFile)).toBe(false);
    });

    it('should convert HEIC file to JPEG', async () => {
      const heicFile = createMockFile('test.heic', 'image/heic', 1024);
      
      // Setup mock to return successful conversion
      mockFormatConverter.convertToOptimalFormat.mockResolvedValue({
        file: new File(['converted-data'], 'test.jpg', { type: 'image/jpeg' }),
        originalFormat: 'image/heic',
        convertedFormat: 'image/jpeg',
        originalSize: 1024,
        convertedSize: 800,
        compressionRatio: 0.78
      });
      
      const convertedFile = await validator.convertHeicToJpeg(heicFile);
      
      expect(convertedFile.name).toBe('test.jpg');
      expect(convertedFile.type).toBe('image/jpeg');
    });

    it('should handle HEIC files with uppercase extension', async () => {
      const heicFile = createMockFile('test.HEIC', 'image/heic', 1024);
      
      // Setup mock to return successful conversion
      mockFormatConverter.convertToOptimalFormat.mockResolvedValue({
        file: new File(['converted-data'], 'test.jpg', { type: 'image/jpeg' }),
        originalFormat: 'image/heic',
        convertedFormat: 'image/jpeg',
        originalSize: 1024,
        convertedSize: 800,
        compressionRatio: 0.78
      });
      
      const convertedFile = await validator.convertHeicToJpeg(heicFile);
      
      expect(convertedFile.name).toBe('test.jpg');
      expect(convertedFile.type).toBe('image/jpeg');
    });

    it('should reject non-HEIC files for conversion', async () => {
      const jpegFile = createMockFile('test.jpg', 'image/jpeg', 1024);
      
      await expect(validator.convertHeicToJpeg(jpegFile)).rejects.toThrow('File is not a HEIC format');
    });

    it('should handle conversion failures', async () => {
      const heicFile = createMockFile('test.heic', 'image/heic', 1024);
      
      // Setup mock to throw an error
      mockFormatConverter.convertToOptimalFormat.mockRejectedValue(new Error('Conversion library failed'));
      
      await expect(validator.convertHeicToJpeg(heicFile)).rejects.toThrow('HEIC conversion failed: Conversion library failed');
    });

    it('should handle module import errors gracefully', async () => {
      const heicFile = createMockFile('test.heic', 'image/heic', 1024);
      
      // This test verifies that the FileValidator properly handles the case where
      // the FormatConverter module might not be available or fails to load
      // Since we're using dynamic imports, we test the error handling path
      
      // Setup mock to simulate a module that throws during conversion
      mockFormatConverter.convertToOptimalFormat.mockRejectedValue(new Error('Module not available'));
      
      await expect(validator.convertHeicToJpeg(heicFile)).rejects.toThrow('HEIC conversion failed: Module not available');
    });
  });

  describe('error handling', () => {
    it('should create validation error from validation results', () => {
      const validationResult = {
        valid: false,
        errors: [
          { code: 'FILE_TOO_LARGE', message: 'File is too large', field: 'size' }
        ],
        warnings: []
      };
      
      const error = validator.createValidationError(validationResult);
      
      expect(error.message).toBe('File is too large');
      expect(error.code).toBe('FILE_TOO_LARGE');
      expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(error.retryable).toBe(false);
      expect(error.details).toEqual({
        errors: validationResult.errors,
        warnings: validationResult.warnings
      });
    });

    it('should handle validation results with no errors', () => {
      const validationResult = {
        valid: false,
        errors: [],
        warnings: []
      };
      
      const error = validator.createValidationError(validationResult);
      
      expect(error.message).toBe('File validation failed');
      expect(error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('default instance', () => {
    it('should export a default fileValidator instance', () => {
      expect(fileValidator).toBeInstanceOf(FileValidator);
    });

    it('should export createFileValidator factory function', () => {
      const customValidator = createFileValidator({ maxSize: 1024 });
      expect(customValidator).toBeInstanceOf(FileValidator);
    });
  });

  describe('edge cases', () => {
    it('should handle files with multiple dots in filename', () => {
      const file = createMockFile('my.photo.final.jpg', 'image/jpeg', 1024);
      const result = validator.validateFileType(file);
      
      expect(result.valid).toBe(true);
    });

    it('should handle files with no extension', () => {
      const file = createMockFile('photo', 'image/jpeg', 1024);
      const result = validator.validateFileType(file);
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_FILE_EXTENSION');
    });

    it('should handle zero-byte files', () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 0);
      const result = validator.validateFileSize(file);
      
      expect(result.valid).toBe(true); // Zero bytes is technically valid, just very small
    });

    it('should handle custom validation rules', () => {
      const customValidator = createFileValidator({
        maxSize: 1024, // 1KB
        allowedTypes: ['image/jpeg']
      });
      
      const file = createMockFile('test.png', 'image/png', 2048);
      const typeResult = customValidator.validateFileType(file);
      const sizeResult = customValidator.validateFileSize(file);
      
      expect(typeResult.valid).toBe(false);
      expect(sizeResult.valid).toBe(false);
    });
  });
});