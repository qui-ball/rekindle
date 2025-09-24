import { UploadOptions, UploadResult, ProgressCallback } from '../types/upload';

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
 * Implementation of UploadService
 * Handles S3 uploads with chunking and retry logic
 */
export class S3UploadService implements UploadService {
  private baseUrl: string;
  private activeUploads: Map<string, AbortController> = new Map();

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  async uploadFile(_file: File, _options: UploadOptions): Promise<UploadResult> {
    // Implementation will be added in task 7.1
    throw new Error('Not implemented yet');
  }

  async generatePresignedUrl(_fileName: string, _fileType: string): Promise<string> {
    // Implementation will be added in task 7.1
    throw new Error('Not implemented yet');
  }

  trackProgress(_uploadId: string, _callback: ProgressCallback): void {
    // Implementation will be added in task 7.1
    throw new Error('Not implemented yet');
  }

  async cancelUpload(_uploadId: string): Promise<void> {
    // Implementation will be added in task 7.1
    throw new Error('Not implemented yet');
  }
}