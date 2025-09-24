// Core types for the application

export interface ProcessingOptions {
  restoration: boolean;
  coloring: boolean;
  quality: 'standard' | 'hd'; // 480p for free, 720p for paid
}

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type UserTier = 'free' | 'remember' | 'cherish' | 'forever';
export type UploadMethod = 'mobile_camera' | 'gallery_picker' | 'drag_drop' | 'file_browser';

export interface User {
  id: string;
  email: string;
  tier: UserTier;
  monthlyCredits: number;
  topupCredits: number;
  subscriptionId?: string;
}

export interface PhotoUpload {
  id: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
  userId: string;
  processingOptions: ProcessingOptions;
  status: JobStatus;
}

export interface ProcessingJob {
  id: string;
  photoId: string;
  jobType: 'restoration' | 'coloring' | 'combined';
  status: JobStatus;
  costCredits: number;
  resultFileKey?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface UploadResult {
  jobId: string;
  status: JobStatus;
  estimatedCompletion?: Date;
}

// API Response types
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };