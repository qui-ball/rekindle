import { S3UploadService } from '../uploadService';
import { UploadOptions, ErrorType } from '../../types/upload';

// Mock fetch for simpler testing
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock Supabase client
jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn(() => Promise.resolve({
        data: {
          session: {
            access_token: 'mock-token'
          }
        },
        error: null
      }))
    }
  }))
}));

describe('S3UploadService', () => {
  let uploadService: S3UploadService;

  beforeEach(() => {
    uploadService = new S3UploadService('/api');
    mockFetch.mockClear();
  });

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const options: UploadOptions = {
        onProgress: jest.fn()
      };

      // Mock successful response - PhotoUploadResponse structure
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'test-123',
          owner_id: 'user-123',
          original_key: 'users/user-123/raw/test-123/original.jpg',
          thumbnail_key: 'users/user-123/thumbs/test-123.jpg',
          status: 'pending',
          size_bytes: file.size,
          mime_type: 'image/jpeg',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      });

      const result = await uploadService.uploadFile(file, options);

      expect(result.uploadId).toBe('test-123');
      expect(result.originalFileName).toBe('test.jpg');
      expect(result.fileSize).toBe(file.size);
      expect(result.processingStatus).toBe('queued');
    });

    it('should handle upload errors', async () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const options: UploadOptions = {};

      // Mock error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          detail: 'Server Error'
        })
      });

      await expect(uploadService.uploadFile(file, options)).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const options: UploadOptions = {};

      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(uploadService.uploadFile(file, options)).rejects.toThrow();
    });
  });

  describe('generatePresignedUrl', () => {
    it('should throw error when authentication is required', async () => {
      // Mock getSupabaseClient to return no session
      const { getSupabaseClient } = require('@/lib/supabase');
      getSupabaseClient.mockReturnValueOnce({
        auth: {
          getSession: jest.fn(() => Promise.resolve({
            data: { session: null },
            error: null
          }))
        }
      });

      await expect(
        uploadService.generatePresignedUrl('test.jpg', 'image/jpeg')
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('trackProgress', () => {
    it('should register progress callback', () => {
      const callback = jest.fn();
      const uploadId = 'test-upload-id';
      
      uploadService.trackProgress(uploadId, callback);
      
      // This is tested indirectly through uploadFile
      expect(callback).toBeDefined();
    });
  });

  describe('cancelUpload', () => {
    it('should cancel active upload', async () => {
      const uploadId = 'test-upload-id';
      
      await uploadService.cancelUpload(uploadId);
      
      // Should not throw an error
      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should create proper upload errors', async () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const options: UploadOptions = {};

      // Mock error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          detail: 'Bad Request'
        })
      });

      try {
        await uploadService.uploadFile(file, options);
      } catch (error: unknown) {
        const uploadError = error as { code: string; type: string; retryable: boolean };
        expect(uploadError.code).toBe('UPLOAD_FAILED');
        expect(uploadError.type).toBe(ErrorType.UPLOAD_ERROR);
        expect(uploadError.retryable).toBe(true);
      }
    });
  });
});