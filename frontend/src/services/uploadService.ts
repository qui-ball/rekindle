import { 
  UploadOptions, 
  UploadResult, 
  ProgressCallback, 
  UploadError, 
  ErrorType,
  RetryStrategy 
} from '../types/upload';
import { getSupabaseClient } from '@/lib/supabase';

/**
 * Core upload service for handling file uploads to S3
 * Manages presigned URLs, progress tracking, and error handling
 * Uses new user-scoped photo API endpoints
 */
export interface UploadService {
  uploadFile(file: File, options: UploadOptions): Promise<UploadResult>;
  generatePresignedUrl(fileName: string, fileType: string): Promise<string>;
  trackProgress(uploadId: string, callback: ProgressCallback): void;
  cancelUpload(uploadId: string): Promise<void>;
}

/**
 * Backend API response types - Updated for new photo API
 */
interface PhotoUploadResponse {
  id: string;
  owner_id: string;
  original_key: string;
  thumbnail_key?: string;
  status: string;
  size_bytes?: number;
  mime_type?: string;
  original_url?: string;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
}

interface PresignedUploadResponse {
  url: string;
  fields: Record<string, string>;
  key: string;
  photo_id: string;
}

interface ApiError {
  detail: string;
  status_code?: number;
}

/**
 * Implementation of UploadService
 * Handles S3 uploads with chunking and retry logic
 */
export class S3UploadService implements UploadService {
  private baseUrl: string;
  private activeUploads: Map<string, AbortController> = new Map();
  private progressCallbacks: Map<string, ProgressCallback> = new Map();
  private defaultRetryStrategy: RetryStrategy = {
    maxAttempts: 3,
    backoffMultiplier: 2,
    initialDelay: 1000,
    maxDelay: 10000,
    retryableErrors: [ErrorType.NETWORK_ERROR, ErrorType.UPLOAD_ERROR]
  };

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  /**
   * Get authentication token from Supabase session
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      const supabase = getSupabaseClient();
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        return null;
      }
      
      return session.access_token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  /**
   * Upload a file to the backend API using new photo endpoints
   * The backend handles S3 upload with user-scoped keys
   */
  async uploadFile(file: File, options: UploadOptions): Promise<UploadResult> {
    const uploadId = this.generateUploadId();
    const abortController = new AbortController();
    
    this.activeUploads.set(uploadId, abortController);
    
    if (options.onProgress) {
      this.progressCallbacks.set(uploadId, options.onProgress);
    }

    try {
      // Get auth token
      const token = await this.getAuthToken();
      if (!token) {
        throw this.createUploadError(
          'AUTH_REQUIRED',
          'Authentication required. Please sign in.',
          ErrorType.PERMISSION_ERROR,
          false
        );
      }

      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('file', file);

      // Upload with progress tracking using new photo endpoint
      const response = await this.uploadWithProgress(
        `${this.baseUrl}/v1/photos/upload`,
        formData,
        uploadId,
        abortController.signal,
        token
      );

      if (!response.ok) {
        // Handle 401 - redirect to login
        if (response.status === 401) {
          window.location.href = '/sign-in?error=Session expired. Please sign in again.';
          throw this.createUploadError(
            'AUTH_REQUIRED',
            'Authentication required',
            ErrorType.PERMISSION_ERROR,
            false
          );
        }

        const errorData: ApiError = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw this.createUploadError(
          'UPLOAD_FAILED',
          `Upload failed: ${errorData.detail}`,
          ErrorType.UPLOAD_ERROR,
          true,
          { status: response.status, detail: errorData.detail }
        );
      }

      const result: PhotoUploadResponse = await response.json();
      
      // Clean up
      this.activeUploads.delete(uploadId);
      this.progressCallbacks.delete(uploadId);

      return this.mapToUploadResult(result, file);

    } catch (error) {
      this.activeUploads.delete(uploadId);
      this.progressCallbacks.delete(uploadId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createUploadError(
          'UPLOAD_CANCELLED',
          'Upload was cancelled',
          ErrorType.UPLOAD_ERROR,
          false
        );
      }
      
      if (error && typeof error === 'object' && 'type' in error) {
        throw error;
      }
      
      throw this.createUploadError(
        'UPLOAD_FAILED',
        `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorType.UPLOAD_ERROR,
        true,
        { originalError: error }
      );
    }
  }

  /**
   * Generate a presigned URL for direct S3 upload
   * Uses new photo API endpoint
   */
  async generatePresignedUrl(fileName: string, fileType: string): Promise<string> {
    const token = await this.getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const maxSizeBytes = 50 * 1024 * 1024; // 50MB
    
    const response = await fetch(
      `${this.baseUrl}/v1/photos/presigned-upload?filename=${encodeURIComponent(fileName)}&content_type=${encodeURIComponent(fileType)}&max_size_bytes=${maxSizeBytes}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/sign-in?error=Session expired. Please sign in again.';
        throw new Error('Authentication required');
      }
      const error = await response.json();
      throw new Error(error.detail || 'Failed to generate presigned URL');
    }

    const data: PresignedUploadResponse = await response.json();
    // Return the presigned URL (client will need to POST to it with fields)
    return data.url;
  }

  /**
   * Track progress for an active upload
   */
  trackProgress(uploadId: string, callback: ProgressCallback): void {
    this.progressCallbacks.set(uploadId, callback);
  }

  /**
   * Cancel an active upload
   */
  async cancelUpload(uploadId: string): Promise<void> {
    const abortController = this.activeUploads.get(uploadId);
    if (abortController) {
      abortController.abort();
      this.activeUploads.delete(uploadId);
      this.progressCallbacks.delete(uploadId);
    }
  }

  /**
   * Upload with progress tracking using fetch
   * Note: fetch doesn't support upload progress, so we simulate it
   */
  private async uploadWithProgress(
    url: string,
    formData: FormData,
    uploadId: string,
    signal: AbortSignal,
    token?: string | null
  ): Promise<Response> {
    try {
      // Simulate progress for testing
      const callback = this.progressCallbacks.get(uploadId);
      if (callback) {
        callback(50); // Simulate 50% progress
        setTimeout(() => callback(100), 100); // Complete after 100ms
      }

      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
        signal
      });

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('AbortError');
      }
      throw error;
    }
  }

  /**
   * Map backend response to UploadResult
   */
  private mapToUploadResult(response: PhotoUploadResponse, file: File): UploadResult {
    return {
      uploadId: response.id,
      fileKey: response.original_key, // User-scoped key: users/{user_id}/raw/{photo_id}/original.{ext}
      thumbnailUrl: response.thumbnail_url || '',
      originalFileName: file.name,
      fileSize: response.size_bytes || file.size,
      dimensions: { width: 0, height: 0 }, // TODO: Extract from file metadata
      processingStatus: response.status === 'ready' ? 'complete' : 'queued'
    };
  }

  /**
   * Create a standardized upload error
   */
  private createUploadError(
    code: string,
    message: string,
    type: ErrorType,
    retryable: boolean,
    details?: unknown
  ): UploadError {
    const error = new Error(message) as UploadError;
    error.code = code;
    error.type = type;
    error.retryable = retryable;
    error.details = details;
    return error;
  }

  /**
   * Generate a unique upload ID
   */
  private generateUploadId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}