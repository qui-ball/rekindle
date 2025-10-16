'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Photo,
  PhotoManagementContainerProps,
  ProcessingOptions,
  ManagementError,
  PaginationOptions
} from '../../types/photo-management';
import { photoManagementService, processingJobService } from '../../services/photoManagementService';
import { PhotoGallery } from './PhotoGallery';
import { PhotoDetailDrawer } from './PhotoDetailDrawer';
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
  // Credit balance is now handled globally
  
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
  // Prevent duplicate initial load (e.g., React StrictMode in dev)
  const didInitRef = useRef<boolean>(false);

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

  // Credit balance is now handled globally

  // Load initial photos
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Create abort controller for cleanup
      abortControllerRef.current = new AbortController();
      
      // Load photos
      await loadPhotos(1, true);
    } catch (err) {
      handleError(err as Error, 'Failed to load initial data');
    } finally {
      setIsLoading(false);
    }
  }, [loadPhotos, handleError]);

  // Load initial data
  useEffect(() => {
    // Prevent duplicate loading in development mode (React StrictMode) and re-mounts
    if (didInitRef.current) return;
    didInitRef.current = true;

    loadInitialData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadInitialData]);

  // Handle photo selection
  const handlePhotoClick = useCallback(async (photo: Photo) => {
    // Fetch full image URL if not already loaded
    if (!photo.metadata.originalUrl) {
      try {
        const response = await fetch(`/api/v1/jobs/${photo.id}/image-url`);
        if (response.ok) {
          const data = await response.json();
          // Update photo with full image URL
          photo.metadata.originalUrl = data.url;
        }
      } catch (error) {
        console.error('Error fetching full image URL:', error);
        // Fallback to thumbnail if full image fails
        photo.metadata.originalUrl = photo.metadata.thumbnailUrl;
      }
    }
    
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
      
      // Reload photos
      const photosData = await loadPhotos(1, true);
      setPhotos(photosData);
    } catch (err) {
      handleError(err as Error, 'Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, loadPhotos, handleError]);

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
      // For now, only handle restore option
      if (!options.restore) {
        throw new Error('Only restore option is currently supported');
      }
      
      // Mock credit data - skip API calls for now
      const mockCreditBalance = {
        totalCredits: 100,
        subscriptionCredits: 25,
        topupCredits: 75,
        subscriptionTier: 'remember' as const,
        lowCreditWarning: false,
        creditHistory: [],
        usageRules: {
          creditsCarryOver: true,
          lostOnCancellation: true
        }
      };
      
      // Calculate cost for restore only (2 credits)
      const restoreCost = 2;
      
      // Check credit availability (using mock data)
      if (restoreCost > mockCreditBalance.totalCredits) {
        throw new Error('Insufficient credits for processing');
      }
      
      // Create processing job (restore only)
      const job = await processingJobService.createProcessingJob(selectedPhoto.id, options);
      
      // Skip credit deduction for now (mock data)
      console.log(`Mock: Deducted ${restoreCost} credits from user ${userId}`);
      
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
        resultType: 'restored',
        fileUrl: '',
        thumbnailUrl: ''
      });
      
      // Close drawer
      handleDrawerClose();
      
    } catch (err) {
      handleError(err as Error, 'Failed to start processing');
    }
  }, [selectedPhoto, userId, onProcessingComplete, handleDrawerClose, handleError]);

  // Credit purchase and subscription are now handled globally

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
        className="photo-management-container h-full"
        role="main"
        aria-label="Photo Management"
      >

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