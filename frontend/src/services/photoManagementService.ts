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
      // Use the existing backend API endpoint for jobs - don't filter by email to get ALL jobs
      const params = new URLSearchParams({
        skip: ((pagination.page - 1) * pagination.limit).toString(),
        limit: pagination.limit.toString()
        // Don't include email parameter to get ALL jobs
      });

      const response = await fetch(`${this.baseUrl}/v1/jobs?${params}`, {
        headers: {
          'Content-Type': 'application/json'
          // TODO: Add auth token when auth is implemented
          // 'Authorization': `Bearer ${await this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch photos: ${response.statusText}`);
      }

      const jobs = await response.json();
      
      // Transform backend Job data to frontend Photo format with presigned URLs
      const photos = await Promise.all(
        jobs.map((job: BackendJob) => this.transformJobToPhoto(job))
      );
      return photos;
      
    } catch (error) {
      console.error('Error fetching photos from API:', error);
      // Return empty array instead of mock data - let UI handle empty state
      return [];
    }
  }

  private async transformJobToPhoto(job: BackendJob): Promise<Photo> {
    // Use thumbnail URL from backend if available
    const thumbnailUrl = job.thumbnail_url || '';
    const uploadedUrl = '';
    
    // Do NOT fetch full image URL here; thumbnail should come from backend
    return {
      id: job.id,
      userId: job.email, // Using email as userId for now
      originalFilename: `${job.id}.jpg`, // Use job ID as filename (no "photo-" prefix)
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
      fileKey: attempt.result_s3_key || '',
      thumbnailKey: attempt.thumb_s3_key || '',
      status: attempt.result_s3_key ? 'completed' : 'processing',
      createdAt: new Date(attempt.created_at),
      completedAt: attempt.result_s3_key ? new Date(attempt.created_at) : undefined,
      processingJobId: attempt.id,
      metadata: {
        dimensions: { width: 1920, height: 1080 },
        fileSize: 1800000,
        format: 'jpeg',
        quality: 'hd',
        processingTime: 45,
        model: attempt.model || 'qwen-3-image-edit',
        parameters: attempt.params || {}
      }
    }));
  }


  async getPhotoDetails(photoId: string): Promise<PhotoDetails> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/photos/${photoId}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch photo details: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching photo details:', error);
      throw error;
    }
  }

  async deletePhoto(photoId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/photos/${photoId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete photo: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting photo:', error);
      throw error;
    }
  }

  async deletePhotoResult(photoId: string, resultId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/photos/${photoId}/results/${resultId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete photo result: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting photo result:', error);
      throw error;
    }
  }

  async downloadPhoto(photoId: string, resultId?: string): Promise<Blob> {
    try {
      const url = resultId 
        ? `${this.baseUrl}/v1/photos/${photoId}/results/${resultId}/download`
        : `${this.baseUrl}/v1/photos/${photoId}/download`;

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to download photo: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Error downloading photo:', error);
      throw error;
    }
  }

  async getPhotoMetadata(photoId: string): Promise<PhotoMetadata> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/photos/${photoId}/metadata`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch photo metadata: ${response.statusText}`);
      }

      return await response.json();
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
      const response = await fetch(`${this.baseUrl}/v1/credits/balance?userId=${userId}`, {
        headers: {
          'Content-Type': 'application/json'
          // TODO: Add auth token when auth is implemented
          // 'Authorization': `Bearer ${await this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch credit balance: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching credit balance from API:', error);
      // Throw error instead of returning mock data - let UI handle the error state
      throw error;
    }
  }

  async calculateProcessingCost(options: ProcessingOptions): Promise<CostBreakdown> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/credits/calculate-cost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options)
      });

      if (!response.ok) {
        throw new Error(`Failed to calculate processing cost: ${response.statusText}`);
      }

      return await response.json();
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
      const response = await fetch(`${this.baseUrl}/v1/credits/deduct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount })
      });

      if (!response.ok) {
        throw new Error(`Failed to deduct credits: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deducting credits:', error);
      throw error;
    }
  }

  async getCreditUsageBreakdown(userId: string, cost: number): Promise<CreditUsageBreakdown> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/credits/usage-breakdown`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cost })
      });

      if (!response.ok) {
        throw new Error(`Failed to get credit usage breakdown: ${response.statusText}`);
      }

      return await response.json();
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
        const response = await fetch(`${this.baseUrl}/v1/jobs/${photoId}/restore`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'comfyui_default',
            params: {
              denoise: 0.8,
              megapixels: options.quality === 'hd' ? 2.0 : 1.0
            }
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to create restore job: ${response.statusText}`);
        }

        const restoreAttempt = await response.json();
        
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
      const response = await fetch(`${this.baseUrl}/v1/processing/jobs/${jobId}/status`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get job status: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting job status:', error);
      throw error;
    }
  }

  async cancelJob(jobId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/processing/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to cancel job: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error cancelling job:', error);
      throw error;
    }
  }

  async retryJob(jobId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/processing/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to retry job: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error retrying job:', error);
      throw error;
    }
  }

  async getProcessingHistory(photoId: string): Promise<PhotoProcessingJob[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/photos/${photoId}/processing-history`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get processing history: ${response.statusText}`);
      }

      return await response.json();
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
