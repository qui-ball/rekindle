import {
  Photo,
  PhotoDetails,
  PhotoMetadata,
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
import { authService } from './authService';

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
        skip: pagination.skip?.toString() || '0',
        limit: pagination.limit.toString()
        // Don't include email parameter to get ALL jobs
      });

      const response = await fetch(`${this.baseUrl}/v1/jobs/jobs?${params}`, {
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
        jobs.map((job: any) => this.transformJobToPhoto(job))
      );
      return photos;
      
    } catch (error) {
      console.error('Error fetching photos from API, using mock data:', error);
      
      // Fallback to mock data for testing
      return this.getMockPhotos(userId, pagination);
    }
  }

  private async transformJobToPhoto(job: any): Promise<Photo> {
    // Get presigned URL for the processed image
    let processedUrl = '';
    let thumbnailUrl = '';
    
    try {
      const response = await fetch(`${this.baseUrl}/v1/jobs/jobs/${job.id}/image-url`);
      if (response.ok) {
        const data = await response.json();
        processedUrl = data.url;
        thumbnailUrl = data.url; // Use same URL for thumbnail
        console.log('Got presigned URL for job:', job.id, 'URL:', processedUrl);
      } else {
        console.error('Failed to get presigned URL for job:', job.id, response.statusText);
      }
    } catch (error) {
      console.error('Error getting presigned URL for job:', job.id, error);
    }
    
    return {
      id: job.id,
      userId: job.email, // Using email as userId for now
      originalFilename: `${job.id}.jpg`, // Use job ID as filename (no "photo-" prefix)
      fileKey: `processed/${job.id}.jpg`,
      thumbnailKey: `processed/${job.id}.jpg`, // Use same key for thumbnail
      status: this.mapJobStatus(job),
      createdAt: new Date(job.created_at),
      updatedAt: new Date(job.created_at),
      metadata: {
        dimensions: { width: 1920, height: 1080 },
        fileSize: 2048000,
        format: 'jpeg',
        uploadMethod: 'camera',
        originalUrl: processedUrl,
        thumbnailUrl: thumbnailUrl
      },
      results: this.transformRestoreAttempts(job.restore_attempts || []),
      processingJobs: []
    };
  }

  private mapJobStatus(job: any): 'uploaded' | 'processing' | 'completed' | 'failed' {
    // Simple status mapping - can be enhanced based on actual job states
    if (job.restore_attempts && job.restore_attempts.length > 0) {
      return 'completed';
    }
    return 'uploaded';
  }

  private transformRestoreAttempts(attempts: any[]): any[] {
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

  private getMockPhotos(userId: string, pagination: PaginationOptions): Photo[] {
    // Enhanced mock data for testing
    const mockPhotos: Photo[] = [
      {
        id: '1',
        userId,
        originalFilename: 'family-photo-1920s.jpg',
        fileKey: 'processed/123.jpg',
        thumbnailKey: 'thumbs/123.jpg',
        status: 'completed',
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
        metadata: {
          dimensions: { width: 1920, height: 1080 },
          fileSize: 2048000,
          format: 'jpeg',
          uploadMethod: 'camera',
          originalUrl: 'https://example.com/original.jpg',
          thumbnailUrl: 'https://example.com/thumb.jpg'
        },
        results: [
          {
            id: '1-1',
            photoId: '1',
            resultType: 'restored',
            fileKey: 'restored/123/restore1.jpg',
            thumbnailKey: 'thumbs/123/restore1.jpg',
            status: 'completed',
            createdAt: new Date('2024-01-15'),
            completedAt: new Date('2024-01-15'),
            processingJobId: 'job-1',
            metadata: {
              dimensions: { width: 1920, height: 1080 },
              fileSize: 1800000,
              format: 'jpeg',
              quality: 'hd',
              processingTime: 45,
              model: 'qwen-3-image-edit',
              parameters: { denoise: 0.7, megapixels: 1.0 }
            }
          }
        ],
        processingJobs: []
      },
      {
        id: '2',
        userId,
        originalFilename: 'wedding-photo-1950s.jpg',
        fileKey: 'processed/456.jpg',
        thumbnailKey: 'thumbs/456.jpg',
        status: 'processing',
        createdAt: new Date('2024-01-14'),
        updatedAt: new Date('2024-01-14'),
        metadata: {
          dimensions: { width: 1600, height: 1200 },
          fileSize: 1800000,
          format: 'jpeg',
          uploadMethod: 'gallery',
          originalUrl: 'https://example.com/original2.jpg',
          thumbnailUrl: 'https://example.com/thumb2.jpg'
        },
        results: [],
        processingJobs: []
      },
      {
        id: '3',
        userId,
        originalFilename: 'baby-photo-1960s.jpg',
        fileKey: 'processed/789.jpg',
        thumbnailKey: 'thumbs/789.jpg',
        status: 'completed',
        createdAt: new Date('2024-01-13'),
        updatedAt: new Date('2024-01-13'),
        metadata: {
          dimensions: { width: 1200, height: 1600 },
          fileSize: 1500000,
          format: 'jpeg',
          uploadMethod: 'camera',
          originalUrl: 'https://example.com/original3.jpg',
          thumbnailUrl: 'https://example.com/thumb3.jpg'
        },
        results: [
          {
            id: '3-1',
            photoId: '3',
            resultType: 'restored',
            fileKey: 'restored/789/restore1.jpg',
            thumbnailKey: 'thumbs/789/restore1.jpg',
            status: 'completed',
            createdAt: new Date('2024-01-13'),
            completedAt: new Date('2024-01-13'),
            processingJobId: 'job-3',
            metadata: {
              dimensions: { width: 1200, height: 1600 },
              fileSize: 1400000,
              format: 'jpeg',
              quality: 'hd',
              processingTime: 38,
              model: 'qwen-3-image-edit',
              parameters: { denoise: 0.8, megapixels: 0.8 }
            }
          }
        ],
        processingJobs: []
      }
    ];

    // Apply pagination
    const start = pagination.skip || 0;
    const end = start + pagination.limit;
    return mockPhotos.slice(start, end);
  }

  async getPhotoDetails(photoId: string): Promise<PhotoDetails> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/photos/${photoId}`, {
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`,
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
          'Authorization': `Bearer ${await this.getAuthToken()}`,
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
          'Authorization': `Bearer ${await this.getAuthToken()}`,
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
          'Authorization': `Bearer ${await this.getAuthToken()}`
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
          'Authorization': `Bearer ${await this.getAuthToken()}`,
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

  private async getAuthToken(): Promise<string> {
    try {
      return await authService.getAccessToken();
    } catch (error) {
      console.error('Failed to get auth token:', error);
      // Redirect to login or show auth error
      throw new Error('Authentication required. Please log in again.');
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
      console.error('Error fetching credit balance from API, using mock data:', error);
      
      // Fallback to mock data for testing
      return this.getMockCreditBalance(userId);
    }
  }

  private getMockCreditBalance(userId: string): CreditBalance {
    return {
      totalCredits: 120,
      subscriptionCredits: 25,
      topupCredits: 95,
      subscriptionTier: 'remember',
      monthlyResetDate: new Date('2024-02-01'),
      lowCreditWarning: false,
      creditHistory: [
        {
          id: '1',
          type: 'earned',
          amount: 25,
          description: 'Monthly subscription credits',
          createdAt: new Date('2024-01-01'),
          processingJobId: undefined
        },
        {
          id: '2',
          type: 'purchased',
          amount: 100,
          description: 'Credit top-up pack',
          createdAt: new Date('2024-01-15'),
          processingJobId: undefined
        },
        {
          id: '3',
          type: 'spent',
          amount: -5,
          description: 'Photo restoration',
          createdAt: new Date('2024-01-20'),
          processingJobId: 'job-1'
        }
      ],
      usageRules: {
        subscriptionFirst: true,
        subscriptionExpires: true,
        topupCarryOver: true
      }
    };
  }

  async calculateProcessingCost(options: ProcessingOptions): Promise<CostBreakdown> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/credits/calculate-cost`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`,
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
          'Authorization': `Bearer ${await this.getAuthToken()}`,
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
          'Authorization': `Bearer ${await this.getAuthToken()}`,
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

  private async getAuthToken(): Promise<string> {
    try {
      return await authService.getAccessToken();
    } catch (error) {
      console.error('Failed to get auth token:', error);
      throw new Error('Authentication required. Please log in again.');
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
      const response = await fetch(`${this.baseUrl}/v1/processing/jobs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ photoId, options })
      });

      if (!response.ok) {
        throw new Error(`Failed to create processing job: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating processing job:', error);
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/processing/jobs/${jobId}/status`, {
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`,
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
          'Authorization': `Bearer ${await this.getAuthToken()}`,
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
          'Authorization': `Bearer ${await this.getAuthToken()}`,
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
          'Authorization': `Bearer ${await this.getAuthToken()}`,
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

  private async getAuthToken(): Promise<string> {
    try {
      return await authService.getAccessToken();
    } catch (error) {
      console.error('Failed to get auth token:', error);
      throw new Error('Authentication required. Please log in again.');
    }
  }
}

// Export service instances
export const photoManagementService = new PhotoManagementServiceImpl();
export const creditManagementService = new CreditManagementServiceImpl();
export const processingJobService = new ProcessingJobServiceImpl();
