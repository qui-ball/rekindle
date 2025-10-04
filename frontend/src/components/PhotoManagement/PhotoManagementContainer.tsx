'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Photo,
  PhotoManagementContainerProps,
  CreditBalance,
  ProcessingOptions,
  ManagementError,
  PaginationOptions
} from '../../types/photo-management';
import { photoManagementService, creditManagementService, processingJobService } from '../../services/photoManagementService';
import { PhotoGallery } from './PhotoGallery';
import { PhotoDetailDrawer } from './PhotoDetailDrawer';
import { CreditBalanceDisplay } from './CreditBalanceDisplay';
import { ErrorBoundary } from './ErrorBoundary';

/**
 * PhotoManagementContainer
 * 
 * Main orchestration component that manages photo gallery state and coordinates 
 * all photo management functionality including:
 * - Photo loading with pagination and infinite scroll
 * - Error handling and loading states
 * - Credit balance management
 * - Processing job coordination
 * - Photo selection and detail viewing
 */
export const PhotoManagementContainer: React.FC<PhotoManagementContainerProps> = ({
  userId,
  onPhotoSelect,
  onProcessingComplete,
  onError
}) => {
  // Core state management
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  
  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<ManagementError | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Refs for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);

  // Error handling
  const handleError = useCallback((error: Error, context: string) => {
    const managementError: ManagementError = {
      type: 'load_error',
      message: `${context}: ${error.message}`,
      retryable: true,
      action: 'retry'
    };
    
    setError(managementError);
    onError?.(managementError);
    console.error(context, error);
  }, [onError]);

  // Load photos with pagination
  const loadPhotos = useCallback(async (page: number, reset: boolean = false): Promise<Photo[]> => {
    try {
      const pagination: PaginationOptions = {
        page,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      };

      const photosData = await photoManagementService.getPhotos(userId, pagination);
      
      if (reset) {
        setPhotos(photosData);
        setCurrentPage(1);
      } else {
        setPhotos(prev => [...prev, ...photosData]);
        setCurrentPage(page);
      }
      
      // Check if there are more photos to load
      setHasMore(photosData.length === pagination.limit);
      
      return photosData;
    } catch (err) {
      throw new Error(`Failed to load photos: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [userId]);

  // Load credit balance
  const loadCreditBalance = useCallback(async (): Promise<CreditBalance> => {
    try {
      const balance = await creditManagementService.getCreditBalance(userId);
      setCreditBalance(balance);
      return balance;
    } catch (err) {
      throw new Error(`Failed to load credit balance: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [userId]);

  // Load initial photos and credit balance
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Create abort controller for cleanup
      abortControllerRef.current = new AbortController();
      
      // Load photos and credit balance in parallel
      const [photosData, creditData] = await Promise.all([
        loadPhotos(1, true),
        loadCreditBalance()
      ]);
      
      setPhotos(photosData);
      setCreditBalance(creditData);
    } catch (err) {
      handleError(err as Error, 'Failed to load initial data');
    } finally {
      setIsLoading(false);
    }
  }, [loadPhotos, loadCreditBalance, handleError]);

  // Load initial data
  useEffect(() => {
    loadInitialData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadInitialData]);

  // Handle photo selection
  const handlePhotoClick = useCallback((photo: Photo) => {
    setSelectedPhoto(photo);
    setIsDrawerOpen(true);
    onPhotoSelect?.(photo);
  }, [onPhotoSelect]);

  // Handle drawer close
  const handleDrawerClose = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedPhoto(null);
  }, []);

  // Handle load more photos (infinite scroll)
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    
    try {
      setIsLoadingMore(true);
      const nextPage = currentPage + 1;
      await loadPhotos(nextPage, false);
    } catch (err) {
      handleError(err as Error, 'Failed to load more photos');
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentPage, hasMore, isLoadingMore, loadPhotos, handleError]);

  // Handle refresh (pull-to-refresh)
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    
    try {
      setIsRefreshing(true);
      setError(null);
      
      // Reload both photos and credit balance
      const [photosData, creditData] = await Promise.all([
        loadPhotos(1, true),
        loadCreditBalance()
      ]);
      
      setPhotos(photosData);
      setCreditBalance(creditData);
    } catch (err) {
      handleError(err as Error, 'Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, loadPhotos, loadCreditBalance, handleError]);

  // Handle photo actions (download, delete, etc.)
  const handlePhotoAction = useCallback(async (action: string, photo: Photo) => {
    try {
      switch (action) {
        case 'download':
          // Handle download logic
          console.log('Download photo:', photo.id);
          break;
        case 'delete':
          // Handle delete logic
          await photoManagementService.deletePhoto(photo.id);
          setPhotos(prev => prev.filter(p => p.id !== photo.id));
          break;
        case 'reprocess':
          // Handle reprocess logic
          console.log('Reprocess photo:', photo.id);
          break;
        default:
          console.warn('Unknown photo action:', action);
      }
    } catch (err) {
      handleError(err as Error, `Failed to ${action} photo`);
    }
  }, [handleError]);

  // Handle processing start
  const handleProcessingStart = useCallback(async (options: ProcessingOptions) => {
    if (!selectedPhoto) return;
    
    try {
      // Check credit availability
      const costBreakdown = await creditManagementService.calculateProcessingCost(options);
      
      if (costBreakdown.totalCost > costBreakdown.availableCredits) {
        throw new Error('Insufficient credits for processing');
      }
      
      // Create processing job
      const job = await processingJobService.createProcessingJob(selectedPhoto.id, options);
      
      // Deduct credits
      await creditManagementService.deductCredits(userId, costBreakdown.totalCost);
      
      // Update credit balance
      await loadCreditBalance();
      
      // Update photo status
      setPhotos(prev => prev.map(p => 
        p.id === selectedPhoto.id 
          ? { ...p, status: 'processing' as const }
          : p
      ));
      
      // Notify parent component
      onProcessingComplete?.({
        photoId: selectedPhoto.id,
        resultId: job.id,
        resultType: 'processing',
        fileUrl: '',
        thumbnailUrl: ''
      });
      
      // Close drawer
      handleDrawerClose();
      
    } catch (err) {
      handleError(err as Error, 'Failed to start processing');
    }
  }, [selectedPhoto, userId, onProcessingComplete, handleDrawerClose, loadCreditBalance, handleError]);

  // Handle credit purchase
  const handlePurchaseCredits = useCallback(() => {
    // TODO: Navigate to credit purchase page
    console.log('Navigate to credit purchase');
  }, []);

  // Handle subscription view
  const handleViewSubscription = useCallback(() => {
    // TODO: Navigate to subscription page
    console.log('Navigate to subscription page');
  }, []);

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" role="status" aria-live="polite">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" aria-hidden="true"></div>
          <p className="text-gray-600">Loading your photos...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" role="alert" aria-live="assertive">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4" aria-hidden="true">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h3>
          <p className="text-gray-600 mb-4">{error.message}</p>
          {error.retryable && (
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              aria-label="Retry loading photos"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  // Render empty state
  if (photos.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" role="status" aria-live="polite">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4" aria-hidden="true">📸</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No photos yet</h3>
          <p className="text-gray-600 mb-4">Upload your first photo to get started</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            aria-label="Refresh photo gallery"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('PhotoManagementContainer error:', error, errorInfo);
        onError?.({
          type: 'load_error',
          message: `Photo management error: ${error.message}`,
          retryable: true,
          action: 'retry'
        });
      }}
    >
      <div 
        className="photo-management-container"
        role="main"
        aria-label="Photo Management"
      >
        {/* Credit Balance Display */}
        {creditBalance && (
          <ErrorBoundary>
            <CreditBalanceDisplay
              balance={creditBalance}
              onPurchaseCredits={handlePurchaseCredits}
              onViewSubscription={handleViewSubscription}
              showWarning={creditBalance.lowCreditWarning}
            />
          </ErrorBoundary>
        )}

        {/* Photo Gallery */}
        <ErrorBoundary>
          <PhotoGallery
            photos={photos}
            onPhotoClick={handlePhotoClick}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
            isLoading={isLoadingMore}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        </ErrorBoundary>

        {/* Photo Detail Drawer */}
        {selectedPhoto && (
          <ErrorBoundary>
            <PhotoDetailDrawer
              isOpen={isDrawerOpen}
              photo={selectedPhoto}
              onClose={handleDrawerClose}
              onPhotoAction={handlePhotoAction}
              onProcessingStart={handleProcessingStart}
            />
          </ErrorBoundary>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default PhotoManagementContainer;