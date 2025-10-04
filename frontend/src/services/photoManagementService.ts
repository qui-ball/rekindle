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
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(pagination.sortBy && { sortBy: pagination.sortBy }),
        ...(pagination.sortOrder && { sortOrder: pagination.sortOrder })
      });

      const response = await fetch(`${this.baseUrl}/v1/photos?${params}`, {
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch photos: ${response.statusText}`);
      }

      const data = await response.json();
      return data.photos || [];
    } catch (error) {
      console.error('Error fetching photos:', error);
      throw error;
    }
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
          'Authorization': `Bearer ${await this.getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch credit balance: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching credit balance:', error);
      throw error;
    }
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
