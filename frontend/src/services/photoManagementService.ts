import {
  Photo,
  PhotoDetails,
  PhotoMetadata,
  PhotoResult,
  PhotoManagementService,
  PaginationOptions,
  CreditBalance,
  CostBreakdown,
  CreditManagementService,
  CreditDeductionResult,
  CreditUsageBreakdown,
  PhotoProcessingJob,
  ProcessingJobService,
  ProcessingOptions,
  JobStatus
} from '../types/photo-management';
import { apiClient } from './apiClient';

// Backend API response types
interface BackendJob {
  id: string;
  email: string;
  created_at: string;
  selected_restore_id?: string;
  latest_animation_id?: string;
  thumbnail_s3_key?: string;
  thumbnail_url?: string;
  restore_attempts?: BackendRestoreAttempt[];
}

interface BackendRestoreAttempt {
  id: string;
  job_id: string;
  s3_key: string;
  model?: string;
  params?: Record<string, unknown>;
  created_at: string;
  url?: string;
  result_s3_key?: string;
  thumb_s3_key?: string;
}

/**
 * Photo Management Service
 * Handles all photo-related API calls and data management
 */
export class PhotoManagementServiceImpl implements PhotoManagementService {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  async getPhotos(userId: string, pagination: PaginationOptions): Promise<Photo[]> {
    try {
      // Use the new photos API endpoint with offset/limit pagination
      const offset = (pagination.page - 1) * pagination.limit;
      const params = new URLSearchParams({
        offset: offset.toString(),
        limit: pagination.limit.toString()
      });

      // Use authenticated API client to get PhotoListResponse
      const response = await apiClient.get<{
        photos: Array<{
          id: string;
          owner_id: string;
          original_key: string;
          processed_key?: string;
          thumbnail_key?: string;
          storage_bucket: string;
          status: string;
          size_bytes?: number;
          mime_type?: string;
          checksum_sha256: string;
          metadata?: Record<string, unknown>;
          created_at: string;
          updated_at: string;
          original_url?: string;
          processed_url?: string;
          thumbnail_url?: string;
        }>;
        total: number;
        limit: number;
        offset: number;
      }>(`/v1/photos?${params}`);
      
      // Transform backend PhotoResponse data to frontend Photo format
      const photos = response.photos.map((photo) => this.transformPhotoResponseToPhoto(photo));
      return photos;
      
    } catch (error) {
      console.error('Error fetching photos from API:', error);
      // Return empty array instead of mock data - let UI handle empty state
      return [];
    }
  }

  private transformPhotoResponseToPhoto(photo: {
    id: string;
    owner_id: string;
    original_key: string;
    processed_key?: string;
    thumbnail_key?: string;
    storage_bucket: string;
    status: string;
    size_bytes?: number;
    mime_type?: string;
    checksum_sha256: string;
    metadata?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    original_url?: string;
    processed_url?: string;
    thumbnail_url?: string;
  }): Photo {
    // Extract filename from original_key (format: users/{user_id}/raw/{photo_id}.{ext})
    const keyParts = photo.original_key.split('/');
    const filename = keyParts[keyParts.length - 1] || `${photo.id}.jpg`;
    
    // Map backend status to frontend status
    const statusMap: Record<string, 'uploaded' | 'processing' | 'completed' | 'failed'> = {
      'uploaded': 'uploaded',
      'processing': 'processing',
      'ready': 'completed',
      'archived': 'completed',
      'deleted': 'failed'
    };
    
    // Extract dimensions from metadata if available
    const metadata = photo.metadata || {};
    const dimensions = (metadata.dimensions as { width?: number; height?: number }) || { width: 1920, height: 1080 };
    
    return {
      id: photo.id,
      userId: photo.owner_id,
      originalFilename: filename,
      fileKey: photo.original_key,
      thumbnailKey: photo.thumbnail_key || '',
      status: statusMap[photo.status] || 'uploaded',
      createdAt: new Date(photo.created_at),
      updatedAt: new Date(photo.updated_at),
      metadata: {
        dimensions: {
          width: dimensions.width || 1920,
          height: dimensions.height || 1080
        },
        fileSize: photo.size_bytes || 0,
        format: photo.mime_type?.split('/')[1] || 'jpeg',
        uploadMethod: 'camera', // Default, can be enhanced later
        originalUrl: photo.original_url || '',
        thumbnailUrl: photo.thumbnail_url || ''
      },
      results: [], // Photo results are separate - can be fetched via getPhotoDetails if needed
      processingJobs: []
    };
  }

  private async transformJobToPhoto(job: BackendJob): Promise<Photo> {
    // Legacy method for backward compatibility - kept for now but should be deprecated
    const thumbnailUrl = job.thumbnail_url || '';
    const uploadedUrl = '';
    
    return {
      id: job.id,
      userId: job.email,
      originalFilename: `${job.id}.jpg`,
      fileKey: `uploaded/${job.id}.jpg`,
      thumbnailKey: job.thumbnail_s3_key || `thumbnails/${job.id}.jpg`,
      status: this.mapJobStatus(job),
      createdAt: new Date(job.created_at),
      updatedAt: new Date(job.created_at),
      metadata: {
        dimensions: { width: 1920, height: 1080 },
        fileSize: 2048000,
        format: 'jpeg',
        uploadMethod: 'camera',
        originalUrl: uploadedUrl,
        thumbnailUrl: thumbnailUrl
      },
      results: this.transformRestoreAttempts(job.restore_attempts || []),
      processingJobs: []
    };
  }

  private mapJobStatus(job: BackendJob): 'uploaded' | 'processing' | 'completed' | 'failed' {
    // Simple status mapping - can be enhanced based on actual job states
    if (job.restore_attempts && job.restore_attempts.length > 0) {
      return 'completed';
    }
    return 'uploaded';
  }

  private transformRestoreAttempts(attempts: BackendRestoreAttempt[]): PhotoResult[] {
    return attempts.map(attempt => ({
      id: attempt.id,
      photoId: attempt.job_id,
      resultType: 'restored' as const,
      fileKey: attempt.s3_key || '', // Use s3_key (the main key), not result_s3_key
      thumbnailKey: attempt.thumb_s3_key || '',
      status: attempt.s3_key && attempt.s3_key !== 'pending' && attempt.s3_key !== '' ? 'completed' : 'processing',
      createdAt: new Date(attempt.created_at),
      completedAt: attempt.s3_key && attempt.s3_key !== 'pending' && attempt.s3_key !== '' ? new Date(attempt.created_at) : undefined,
      processingJobId: attempt.id,
      metadata: {
        dimensions: { width: 1920, height: 1080 },
        fileSize: 1800000,
        format: 'jpeg',
        quality: 'hd',
        processingTime: 45,
        model: attempt.model || 'comfyui_default',
        parameters: attempt.params || {}
      }
    }));
  }


  async getPhotoDetails(photoId: string): Promise<PhotoDetails> {
    try {
      const response = await apiClient.get<{
        photo: {
          id: string;
          owner_id: string;
          original_key: string;
          processed_key?: string;
          thumbnail_key?: string;
          storage_bucket: string;
          status: string;
          size_bytes?: number;
          mime_type?: string;
          checksum_sha256: string;
          metadata?: Record<string, unknown>;
          created_at: string;
          updated_at: string;
          original_url?: string;
          processed_url?: string;
          thumbnail_url?: string;
        };
        results: Array<{
          id: string;
          job_id: string;
          s3_key: string;
          model?: string;
          params?: Record<string, unknown>;
          created_at: string;
          url?: string;
        }>;
        processingJobs: any[];
        relatedPhotos: any[];
      }>(`/v1/photos/${photoId}`);
      
      // Transform the response to PhotoDetails format
      const photo = this.transformPhotoResponseToPhoto(response.photo);
      
      // Transform results from restore attempts
      const results: PhotoResult[] = response.results.map(result => {
        let status: 'processing' | 'completed' | 'failed' = 'processing';
        if (result.s3_key === 'failed') {
          status = 'failed';
        } else if (result.s3_key && result.s3_key !== 'pending' && result.s3_key !== '') {
          status = 'completed';
        }
        
        return {
          id: result.id,
          photoId: result.job_id,
          resultType: 'restored' as const,
          fileKey: result.s3_key || '',
          thumbnailKey: '',
          status: status,
          createdAt: new Date(result.created_at),
          completedAt: status === 'completed' ? new Date(result.created_at) : undefined,
          processingJobId: result.id,
          metadata: {
            dimensions: { width: 1920, height: 1080 },
            fileSize: 1800000,
            format: 'jpeg',
            quality: 'hd',
            processingTime: 45,
            model: result.model || 'comfyui_default',
            parameters: result.params || {}
          }
        };
      });
      
      return {
        photo: {
          ...photo,
          results: results // Also include results in photo object for convenience
        },
        results: results,
        processingJobs: response.processingJobs || [],
        relatedPhotos: (response.relatedPhotos || []).map(p => this.transformPhotoResponseToPhoto(p))
      };
    } catch (error) {
      console.error('Error fetching photo details:', error);
      throw error;
    }
  }

  async deletePhoto(photoId: string): Promise<void> {
    try {
      await apiClient.delete(`/v1/photos/${photoId}`);
    } catch (error) {
      console.error('Error deleting photo:', error);
      throw error;
    }
  }

  async deletePhotoResult(photoId: string, resultId: string): Promise<void> {
    try {
      await apiClient.delete(`/v1/photos/${photoId}/results/${resultId}`);
    } catch (error) {
      console.error('Error deleting photo result:', error);
      throw error;
    }
  }

  async downloadPhoto(photoId: string, resultId?: string): Promise<Blob> {
    try {
      const path = resultId 
        ? `/v1/photos/${photoId}/results/${resultId}/download`
        : `/v1/photos/${photoId}/download`;

      return await apiClient.getBlob(path);
    } catch (error) {
      console.error('Error downloading photo:', error);
      throw error;
    }
  }

  async getPhotoMetadata(photoId: string): Promise<PhotoMetadata> {
    try {
      return await apiClient.get<PhotoMetadata>(`/v1/photos/${photoId}/metadata`);
    } catch (error) {
      console.error('Error fetching photo metadata:', error);
      throw error;
    }
  }

}

/**
 * Credit Management Service
 * Handles credit balance and cost calculations
 */
export class CreditManagementServiceImpl implements CreditManagementService {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  async getCreditBalance(userId: string): Promise<CreditBalance> {
    try {
      return await apiClient.get<CreditBalance>(`/v1/credits/balance?userId=${userId}`);
    } catch (error) {
      console.error('Error fetching credit balance from API:', error);
      // Throw error instead of returning mock data - let UI handle the error state
      throw error;
    }
  }

  async calculateProcessingCost(options: ProcessingOptions): Promise<CostBreakdown> {
    try {
      return await apiClient.post<CostBreakdown>(`/v1/credits/calculate-cost`, options);
    } catch (error) {
      console.error('Error calculating processing cost:', error);
      throw error;
    }
  }

  async checkCreditAvailability(_userId: string, cost: number): Promise<boolean> {
    try {
      const balance = await this.getCreditBalance(_userId);
      return balance.totalCredits >= cost;
    } catch (error) {
      console.error('Error checking credit availability:', error);
      return false;
    }
  }

  async deductCredits(userId: string, amount: number): Promise<CreditDeductionResult> {
    try {
      return await apiClient.post<CreditDeductionResult>(`/v1/credits/deduct`, { amount });
    } catch (error) {
      console.error('Error deducting credits:', error);
      throw error;
    }
  }

  async getCreditUsageBreakdown(userId: string, cost: number): Promise<CreditUsageBreakdown> {
    try {
      return await apiClient.post<CreditUsageBreakdown>(`/v1/credits/usage-breakdown`, { cost });
    } catch (error) {
      console.error('Error getting credit usage breakdown:', error);
      throw error;
    }
  }

}

/**
 * Processing Job Service
 * Handles processing job creation and status management
 */
export class ProcessingJobServiceImpl implements ProcessingJobService {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  async createProcessingJob(photoId: string, options: ProcessingOptions): Promise<PhotoProcessingJob> {
    try {
      // For now, only handle restore option
      if (options.restore) {
        // Use photos endpoint instead of jobs endpoint
        const restoreAttempt = await apiClient.post<BackendRestoreAttempt>(`/v1/photos/${photoId}/restore`, {
          model: 'comfyui_default',
          params: {
            denoise: 0.8,
            megapixels: options.quality === 'hd' ? 2.0 : 1.0
          }
        });
        
        // Transform to PhotoProcessingJob format
        return {
          id: restoreAttempt.id,
          photoId: photoId,
          userId: '', // Will be filled by parent component
          options: options,
          status: 'queued',
          priority: 1,
          costCredits: 2, // Restore costs 2 credits
          createdAt: new Date(restoreAttempt.created_at),
          resultIds: [restoreAttempt.id]
        };
      } else {
        throw new Error('Only restore option is currently supported');
      }
    } catch (error) {
      console.error('Error creating processing job:', error);
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    try {
      return await apiClient.get<JobStatus>(`/v1/processing/jobs/${jobId}/status`);
    } catch (error) {
      console.error('Error getting job status:', error);
      throw error;
    }
  }

  async cancelJob(jobId: string): Promise<void> {
    try {
      await apiClient.post(`/v1/processing/jobs/${jobId}/cancel`);
    } catch (error) {
      console.error('Error cancelling job:', error);
      throw error;
    }
  }

  async retryJob(jobId: string): Promise<void> {
    try {
      await apiClient.post(`/v1/processing/jobs/${jobId}/retry`);
    } catch (error) {
      console.error('Error retrying job:', error);
      throw error;
    }
  }

  async getProcessingHistory(photoId: string): Promise<PhotoProcessingJob[]> {
    try {
      return await apiClient.get<PhotoProcessingJob[]>(`/v1/photos/${photoId}/processing-history`);
    } catch (error) {
      console.error('Error getting processing history:', error);
      throw error;
    }
  }

}

// Export service instances
export const photoManagementService = new PhotoManagementServiceImpl();
export const creditManagementService = new CreditManagementServiceImpl();
export const processingJobService = new ProcessingJobServiceImpl();
