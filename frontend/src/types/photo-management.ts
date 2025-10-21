/**
 * Photo Management System Types
 * Defines interfaces for photo gallery, detail drawer, and processing options
 */

// Photo Management Data Models
export interface Photo {
  id: string;
  userId: string;
  originalFilename: string;
  fileKey: string;
  thumbnailKey: string;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  metadata: PhotoMetadata;
  results: PhotoResult[];
  processingJobs: PhotoProcessingJob[];
}

export interface PhotoMetadata {
  dimensions: { width: number; height: number };
  fileSize: number;
  format: string;
  uploadMethod: 'camera' | 'gallery' | 'desktop' | 'qr' | 'share';
  originalUrl: string;
  thumbnailUrl: string;
}

export interface PhotoResult {
  id: string;
  photoId: string;
  resultType: 'restored' | 'colourized' | 'animated' | 'combined';
  fileKey: string;
  thumbnailKey: string;
  status: 'processing' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  processingJobId: string;
  metadata: ResultMetadata;
}

export interface ResultMetadata {
  dimensions: { width: number; height: number };
  fileSize: number;
  format: string;
  quality: 'standard' | 'hd';
  processingTime: number;
  model: string;
  parameters: Record<string, unknown>;
}

// Credit Management Types
export interface CreditBalance {
  totalCredits: number;
  subscriptionTier: 'free' | 'remember' | 'cherish' | 'forever';
  nextBillingDate?: Date;
  lowCreditWarning: boolean;
  creditHistory: CreditTransaction[];
  usageRules: {
    creditsCarryOver: true;
    lostOnCancellation: true;
  };
}

export interface CreditTransaction {
  id: string;
  type: 'earned' | 'spent' | 'purchased' | 'refunded';
  amount: number;
  description: string;
  createdAt: Date;
  processingJobId?: string;
}

// Processing Options Types
export interface ProcessingOptions {
  restore: boolean;
  animate: boolean;
  bringTogether: boolean;
  quality: 'standard' | 'hd';
  parameters?: ProcessingParameters;
}

// Processing Parameters (for each processing type)
export interface ProcessingParameters {
  restore?: RestoreParameters;
  animate?: AnimateParameters;
  bringTogether?: BringTogetherParameters;
}

export interface RestoreParameters {
  colourize: boolean; // Common parameter - colourize is ONLY available as part of restore
  denoiseLevel?: number; // Advanced: 0.5-0.9 (default: 0.7) - denoise strength
  userPrompt?: string; // Advanced: custom instructions
}

export interface AnimateParameters {
  videoDuration: number; // Common parameter: duration in seconds (5-30)
  userPrompt?: string; // Advanced: custom instructions for animation
}

export interface BringTogetherParameters {
  // Future parameters can be added here
}

export interface CostBreakdown {
  individualCosts: {
    restore: number;
    colourize: number;
    animate: number;
    bringTogether: number;
  };
  subtotal: number;
  combinedDiscount: number;
  totalCost: number;
  availableCredits: number;
  remainingCredits: number;
}

export interface PhotoProcessingJob {
  id: string;
  photoId: string;
  userId: string;
  options: ProcessingOptions;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  costCredits: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletion?: Date;
  error?: string;
  resultIds: string[];
}

// API Response Types
export interface PhotoGalleryResponse {
  photos: Photo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  creditBalance: CreditBalance;
}

export interface PhotoDetailResponse {
  photo: Photo;
  results: PhotoResult[];
  processingJobs: PhotoProcessingJob[];
  relatedPhotos: Photo[];
}

// Component Props Types
export interface PhotoManagementContainerProps {
  userId: string;
  onPhotoSelect?: (photo: Photo) => void;
  onProcessingComplete?: (result: ProcessingResult) => void;
  onError?: (error: ManagementError) => void;
}

export interface PhotoGalleryProps {
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export interface PhotoDetailDrawerProps {
  isOpen: boolean;
  photo: Photo | null;
  onClose: () => void;
  onPhotoAction: (action: PhotoAction, photo: Photo) => void;
  onProcessingStart: (options: ProcessingOptions) => void;
}

export interface ProcessingOptionsPanelProps {
  photo: Photo;
  availableCredits: CreditBalance;
  onOptionsChange: (options: ProcessingOptions) => void;
  onProcess: (options: ProcessingOptions) => void;
  isProcessing: boolean;
}

export interface ProcessingParameterDrawerProps {
  processingType: 'restore' | 'animate' | 'bringTogether';
  isOpen: boolean;
  parameters: RestoreParameters | AnimateParameters | BringTogetherParameters;
  onParametersChange: (parameters: RestoreParameters | AnimateParameters | BringTogetherParameters) => void;
  advancedOptionsOpen: boolean;
  onToggleAdvancedOptions: () => void;
}

export interface CreditBalanceDisplayProps {
  balance: CreditBalance;
  onPurchaseCredits: () => void;
  onViewSubscription: () => void;
  showWarning: boolean;
}

export interface PhotoStatusIndicatorProps {
  status: ProcessingStatus;
  progress?: number;
  estimatedTime?: number;
  onRetry?: () => void;
}

// Action and Status Types
export type PhotoAction = 'download' | 'delete' | 'reprocess';

export type ProcessingStatus = 'ready' | 'queued' | 'processing' | 'completed' | 'failed';

export interface ProcessingResult {
  photoId: string;
  resultId: string;
  resultType: string;
  fileUrl: string;
  thumbnailUrl: string;
}

export interface ManagementError {
  type: 'load_error' | 'processing_error' | 'credit_error' | 'network_error' | 'permission_error' | 'storage_error';
  message: string;
  retryable: boolean;
  action?: string;
  details?: unknown;
}

// Service Interface Types
export interface PhotoManagementService {
  getPhotos(userId: string, pagination: PaginationOptions): Promise<Photo[]>;
  getPhotoDetails(photoId: string): Promise<PhotoDetails>;
  deletePhoto(photoId: string): Promise<void>;
  deletePhotoResult(photoId: string, resultId: string): Promise<void>;
  downloadPhoto(photoId: string, resultId?: string): Promise<Blob>;
  getPhotoMetadata(photoId: string): Promise<PhotoMetadata>;
}

export interface CreditManagementService {
  getCreditBalance(userId: string): Promise<CreditBalance>;
  calculateProcessingCost(options: ProcessingOptions): Promise<CostBreakdown>;
  checkCreditAvailability(userId: string, cost: number): Promise<boolean>;
  deductCredits(userId: string, amount: number): Promise<CreditDeductionResult>;
  getCreditUsageBreakdown(userId: string, cost: number): Promise<CreditUsageBreakdown>;
}

export interface ProcessingJobService {
  createProcessingJob(photoId: string, options: ProcessingOptions): Promise<PhotoProcessingJob>;
  getJobStatus(jobId: string): Promise<JobStatus>;
  cancelJob(jobId: string): Promise<void>;
  retryJob(jobId: string): Promise<void>;
  getProcessingHistory(photoId: string): Promise<PhotoProcessingJob[]>;
}

// Supporting Types
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'filename';
  sortOrder?: 'asc' | 'desc';
}

export interface PhotoDetails {
  photo: Photo;
  results: PhotoResult[];
  processingJobs: PhotoProcessingJob[];
  relatedPhotos: Photo[];
}

export interface CreditDeductionResult {
  creditsUsed: number;
  remainingCredits: number;
  transactionId: string;
}

export interface CreditUsageBreakdown {
  totalCost: number;
  availableCredits: number;
  remainingAfterProcessing: number;
  canAfford: boolean;
}

export interface JobStatus {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  estimatedCompletion?: Date;
  error?: string;
}
