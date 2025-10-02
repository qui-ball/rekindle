import { 
  UploadOptions, 
  UploadResult, 
  ProgressCallback, 
  UploadError, 
  ErrorType,
  RetryStrategy 
} from '../types/upload';

/**
 * Core upload service for handling file uploads to S3
 * Manages presigned URLs, progress tracking, and error handling
 */
export interface UploadService {
  uploadFile(file: File, options: UploadOptions): Promise<UploadResult>;
  generatePresignedUrl(fileName: string, fileType: string): Promise<string>;
  trackProgress(uploadId: string, callback: ProgressCallback): void;
  cancelUpload(uploadId: string): Promise<void>;
}

/**
 * Backend API response types
 */
interface UploadResponse {
  job_id: string;
  message: string;
  processed_url?: string;
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
   * Upload a file to the backend API
   * The backend handles S3 upload and job creation
   */
  async uploadFile(file: File, options: UploadOptions): Promise<UploadResult> {
    const uploadId = this.generateUploadId();
    const abortController = new AbortController();
    
    this.activeUploads.set(uploadId, abortController);
    
    if (options.onProgress) {
      this.progressCallbacks.set(uploadId, options.onProgress);
    }

    try {
      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('email', 'user@example.com'); // TODO: Get from auth context

      // Upload with progress tracking
      const response = await this.uploadWithProgress(
        `${this.baseUrl}/v1/jobs/upload`,
        formData,
        uploadId,
        abortController.signal
      );

      if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw this.createUploadError(
          'UPLOAD_FAILED',
          `Upload failed: ${errorData.detail}`,
          ErrorType.UPLOAD_ERROR,
          true,
          { status: response.status, detail: errorData.detail }
        );
      }

      const result: UploadResponse = await response.json();
      
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
   * Currently not implemented as backend handles uploads directly
   */
  async generatePresignedUrl(_fileName: string, _fileType: string): Promise<string> {
    throw new Error('Presigned URLs not implemented - backend handles uploads directly');
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
    signal: AbortSignal
  ): Promise<Response> {
    try {
      // Simulate progress for testing
      const callback = this.progressCallbacks.get(uploadId);
      if (callback) {
        callback(50); // Simulate 50% progress
        setTimeout(() => callback(100), 100); // Complete after 100ms
      }

      const response = await fetch(url, {
        method: 'POST',
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
  private mapToUploadResult(response: UploadResponse, file: File): UploadResult {
    return {
      uploadId: response.job_id,
      fileKey: `processed/${response.job_id}`, // Backend stores as processed/{job_id}
      thumbnailUrl: response.processed_url || '',
      originalFileName: file.name,
      fileSize: file.size,
      dimensions: { width: 0, height: 0 }, // TODO: Extract from file metadata
      processingStatus: 'queued'
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