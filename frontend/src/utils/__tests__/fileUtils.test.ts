/**
 * File Utilities Tests
 * 
 * Tests file handling and validation functions
 * 
 * Test Coverage:
 * - File validation (size and type)
 * - MIME type validation
 * - File extension fallback validation (for HEIC)
 * - Edge cases
 */

import { validateFile, base64ToFile, fileToDataUrl } from '../fileUtils';

describe('validateFile', () => {
  const DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50MB
  const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];

  describe('Size Validation', () => {
    it('accepts file within size limit', () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 1024 * 1024); // 1MB
      
      const result = validateFile(file, DEFAULT_MAX_SIZE, DEFAULT_ALLOWED_TYPES);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects file exceeding size limit', () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 60 * 1024 * 1024); // 60MB
      
      const result = validateFile(file, DEFAULT_MAX_SIZE, DEFAULT_ALLOWED_TYPES);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File too large');
      expect(result.error).toContain('50MB');
    });

    it('accepts file exactly at size limit', () => {
      const file = createMockFile('test.jpg', 'image/jpeg', DEFAULT_MAX_SIZE);
      
      const result = validateFile(file, DEFAULT_MAX_SIZE, DEFAULT_ALLOWED_TYPES);
      
      expect(result.valid).toBe(true);
    });

    it('uses custom max size when provided', () => {
      const customMaxSize = 10 * 1024 * 1024; // 10MB
      const file = createMockFile('test.jpg', 'image/jpeg', 15 * 1024 * 1024); // 15MB
      
      const result = validateFile(file, customMaxSize, DEFAULT_ALLOWED_TYPES);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('10MB');
    });
  });

  describe('MIME Type Validation', () => {
    it('accepts JPEG file', () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      
      const result = validateFile(file, DEFAULT_MAX_SIZE, DEFAULT_ALLOWED_TYPES);
      
      expect(result.valid).toBe(true);
    });

    it('accepts PNG file', () => {
      const file = createMockFile('test.png', 'image/png', 1024);
      
      const result = validateFile(file, DEFAULT_MAX_SIZE, DEFAULT_ALLOWED_TYPES);
      
      expect(result.valid).toBe(true);
    });

    it('accepts WebP file', () => {
      const file = createMockFile('test.webp', 'image/webp', 1024);
      
      const result = validateFile(file, DEFAULT_MAX_SIZE, DEFAULT_ALLOWED_TYPES);
      
      expect(result.valid).toBe(true);
    });

    it('accepts HEIC file with correct MIME type', () => {
      const file = createMockFile('test.heic', 'image/heic', 1024);
      
      const result = validateFile(file, DEFAULT_MAX_SIZE, DEFAULT_ALLOWED_TYPES);
      
      expect(result.valid).toBe(true);
    });

    it('rejects unsupported MIME type', () => {
      const file = createMockFile('test.txt', 'text/plain', 1024);
      
      const result = validateFile(file, DEFAULT_MAX_SIZE, DEFAULT_ALLOWED_TYPES);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported file type');
    });

    it('rejects GIF file when not in allowed types', () => {
      const file = createMockFile('test.gif', 'image/gif', 1024);
      
      const result = validateFile(file, DEFAULT_MAX_SIZE, DEFAULT_ALLOWED_TYPES);
      
      expect(result.valid).toBe(false);
    });
  });

  describe('File Extension Fallback (HEIC Support)', () => {
    it('accepts HEIC file with empty MIME type via extension fallback', () => {
      // Simulates iOS Safari behavior where HEIC files have empty MIME type
      const file = createMockFile('photo.heic', '', 1024);
      
      const result = validateFile(file, DEFAULT_MAX_SIZE, DEFAULT_ALLOWED_TYPES);
      
      expect(result.valid).toBe(true);
    });

    it('accepts HEIF file with empty MIME type via extension fallback', () => {
      const file = createMockFile('photo.heif', '', 1024);
      
      const result = validateFile(file, DEFAULT_MAX_SIZE, DEFAULT_ALLOWED_TYPES);
      
      expect(result.valid).toBe(true);
    });

    it('accepts JPEG file with empty MIME type via extension fallback', () => {
      const file = createMockFile('photo.jpg', '', 1024);
      
      const result = validateFile(file, DEFAULT_MAX_SIZE, DEFAULT_ALLOWED_TYPES);
      
      expect(result.valid).toBe(true);
    });

    it('accepts JPEG file with .jpeg extension via fallback', () => {
      const file = createMockFile('photo.jpeg', '', 1024);
      
      const result = validateFile(file, DEFAULT_MAX_SIZE, DEFAULT_ALLOWED_TYPES);
      
      expect(result.valid).toBe(true);
    });

    it('accepts PNG file with empty MIME type via extension fallback', () => {
      const file = createMockFile('photo.png', '', 1024);
      
      const result = validateFile(file, DEFAULT_MAX_SIZE, DEFAULT_ALLOWED_TYPES);
      
      expect(result.valid).toBe(true);
    });

    it('accepts WebP file with empty MIME type via extension fallback', () => {
      const file = createMockFile('photo.webp', '', 1024);
      
      const result = validateFile(file, DEFAULT_MAX_SIZE, DEFAULT_ALLOWED_TYPES);
      
      expect(result.valid).toBe(true);
    });

    it('handles uppercase extension', () => {
      const file = createMockFile('PHOTO.HEIC', '', 1024);
      
      const result = validateFile(file, DEFAULT_MAX_SIZE, DEFAULT_ALLOWED_TYPES);
      
      expect(result.valid).toBe(true);
    });

    it('handles mixed case extension', () => {
      const file = createMockFile('Photo.HeIc', '', 1024);
      
      const result = validateFile(file, DEFAULT_MAX_SIZE, DEFAULT_ALLOWED_TYPES);
      
      expect(result.valid).toBe(true);
    });

    it('rejects file with unsupported extension and empty MIME type', () => {
      const file = createMockFile('document.pdf', '', 1024);
      
      const result = validateFile(file, DEFAULT_MAX_SIZE, DEFAULT_ALLOWED_TYPES);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported file type');
    });

    it('rejects file with no extension and empty MIME type', () => {
      const file = createMockFile('noextension', '', 1024);
      
      const result = validateFile(file, DEFAULT_MAX_SIZE, DEFAULT_ALLOWED_TYPES);
      
      expect(result.valid).toBe(false);
    });
  });

  describe('Default Parameters', () => {
    it('uses default max size when not provided', () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 40 * 1024 * 1024); // 40MB
      
      const result = validateFile(file);
      
      expect(result.valid).toBe(true);
    });

    it('uses default allowed types when not provided', () => {
      const jpegFile = createMockFile('test.jpg', 'image/jpeg', 1024);
      const pngFile = createMockFile('test.png', 'image/png', 1024);
      const heicFile = createMockFile('test.heic', 'image/heic', 1024);
      const webpFile = createMockFile('test.webp', 'image/webp', 1024);
      
      expect(validateFile(jpegFile).valid).toBe(true);
      expect(validateFile(pngFile).valid).toBe(true);
      expect(validateFile(heicFile).valid).toBe(true);
      expect(validateFile(webpFile).valid).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('handles zero-byte file', () => {
      const file = createMockFile('empty.jpg', 'image/jpeg', 0);
      
      const result = validateFile(file, DEFAULT_MAX_SIZE, DEFAULT_ALLOWED_TYPES);
      
      expect(result.valid).toBe(true);
    });

    it('handles filename with multiple dots', () => {
      const file = createMockFile('photo.backup.2024.heic', '', 1024);
      
      const result = validateFile(file, DEFAULT_MAX_SIZE, DEFAULT_ALLOWED_TYPES);
      
      expect(result.valid).toBe(true);
    });

    it('handles filename ending with dot', () => {
      const file = createMockFile('photo.', '', 1024);
      
      const result = validateFile(file, DEFAULT_MAX_SIZE, DEFAULT_ALLOWED_TYPES);
      
      expect(result.valid).toBe(false);
    });
  });
});

describe('fileToDataUrl', () => {
  it('converts File to base64 data URL', async () => {
    const file = createMockFile('test.jpg', 'image/jpeg', 1024);
    
    const dataUrl = await fileToDataUrl(file);
    
    expect(dataUrl).toContain('data:image/jpeg;base64,');
    expect(typeof dataUrl).toBe('string');
  });

  it('rejects on file read error', async () => {
    // Create a file that will fail to read
    const file = createMockFile('test.jpg', 'image/jpeg', 1024);
    
    // Mock FileReader to fail
    const originalFileReader = global.FileReader;
    interface MockFileReaderInstance {
      readAsDataURL: jest.Mock;
      result: string | null;
      onload: (() => void) | null;
      onerror: ((err: Error) => void) | null;
    }
    global.FileReader = jest.fn().mockImplementation(function (this: MockFileReaderInstance) {
      this.readAsDataURL = jest.fn(function (this: MockFileReaderInstance) {
        setTimeout(() => {
          if (this.onerror) {
            this.onerror(new Error('Read failed'));
          }
        }, 0);
      });
      this.result = null;
      this.onload = null;
      this.onerror = null;
    }) as unknown as typeof FileReader;
    
    await expect(fileToDataUrl(file)).rejects.toThrow('Failed to read file');
    
    global.FileReader = originalFileReader;
  });
});

describe('base64ToFile', () => {
  it('converts base64 string to File with correct name', () => {
    const base64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    
    const file = base64ToFile(base64, 'test.jpg', 'image/jpeg');
    
    expect(file.name).toBe('test.jpg');
    expect(file.type).toBe('image/jpeg');
  });

  it('handles base64 without data URL prefix', () => {
    const base64 = '/9j/4AAQSkZJRg==';
    
    const file = base64ToFile(base64, 'test.jpg', 'image/jpeg');
    
    expect(file.name).toBe('test.jpg');
  });

  it('uses default MIME type when not provided', () => {
    const base64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    
    const file = base64ToFile(base64, 'test.jpg');
    
    expect(file.type).toBe('image/jpeg');
  });
});

/**
 * Helper function to create mock File objects
 */
function createMockFile(name: string, type: string, size: number): File {
  const blob = new Blob(['x'.repeat(size)], { type });
  return new File([blob], name, { type });
}
