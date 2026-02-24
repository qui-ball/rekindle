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
import { useJobEvents } from '../../hooks/useJobEvents';
import { getSupabaseClient } from '@/lib/supabase';
import { Headline } from '@/components/ui/Headline';
import { Body } from '@/components/ui/Body';
import { Button } from '@/components/ui/Button';

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
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
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

  // Listen for SSE job completion events
  useJobEvents(activeJobId, {
    onCompleted: async (data) => {
      // Update photo status
      setPhotos(prev => prev.map(p => 
        p.id === data.job_id 
          ? { ...p, status: 'completed' as const }
          : p
      ));
      
      // Refresh the specific photo to get updated restore attempts
      try {
        // Update the selected photo in the drawer to show the new restoration
        if (selectedPhoto && selectedPhoto.id === data.job_id) {
          // Fetch full photo details to get results
          const photoDetails = await photoManagementService.getPhotoDetails(data.job_id);
          setSelectedPhoto({
            ...selectedPhoto,
            ...photoDetails.photo,
            results: photoDetails.results,
            processingJobs: photoDetails.processingJobs,
          });
        }
        
        // Also refresh the photos list
        const updatedPhotos = await photoManagementService.getPhotos(userId, {
          page: 1,
          limit: 100,
          sortBy: 'createdAt',
          sortOrder: 'desc'
        });
        setPhotos(updatedPhotos);
      } catch (err) {
        console.error('Error refreshing photos after job completion:', err);
      }
      
      // Clear active job
      setActiveJobId(null);
    }
  });

  // Error handling
  const handleError = useCallback((error: Error, context: string) => {
    // Check if this is an authentication error (401)
    const isAuthError = error.message.includes('401') || 
                       error.message.includes('Unauthorized') ||
                       error.message.includes('Authentication required') ||
                       error.message.includes('Session expired') ||
                       error.message.includes('Invalid token');
    
    if (isAuthError && typeof window !== 'undefined') {
      console.error(`${context}: Authentication error detected, redirecting to sign-in`);
      const currentPath = window.location.pathname;
      const isOnSignInPage = currentPath === '/sign-in' || currentPath.startsWith('/sign-in');
      if (!isOnSignInPage) {
        // Redirect to sign-in - apiClient should have already tried refreshing
        window.location.replace(`/sign-in?error=${encodeURIComponent('Session expired. Please sign in again.')}&next=${encodeURIComponent(currentPath)}`);
        return; // Don't set error state, we're redirecting
      }
    }
    
    const managementError: ManagementError = {
      type: 'load_error',
      message: `${context}: ${error.message}`,
      retryable: !isAuthError, // Don't allow retry for auth errors
      action: isAuthError ? 'redirect' : 'retry'
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
      
      // Ensure we have a valid auth token before making API calls
      const supabase = getSupabaseClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('No valid session found:', sessionError);
        throw new Error('Authentication required. Please sign in again.');
      }
      
      if (!session.access_token) {
        console.error('Session exists but no access_token');
        throw new Error('Authentication token missing. Please sign in again.');
      }
      
      // Validate token format - must be a JWT (starts with "eyJ")
      if (!session.access_token.startsWith('eyJ')) {
        console.error(`Invalid token format! Token does not look like a JWT. Token preview: ${session.access_token.substring(0, 100)}`);
        // Try to refresh the session
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshedSession || !refreshedSession.access_token || !refreshedSession.access_token.startsWith('eyJ')) {
          throw new Error('Invalid authentication token. Please sign in again.');
        }
      }
      
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
    // Always fetch full photo details to get results
    let photoToSelect = photo;
    try {
      const photoDetails = await photoManagementService.getPhotoDetails(photo.id);
      photoToSelect = {
        ...photo,
        ...photoDetails.photo,
        results: photoDetails.results, // Include results from details
        processingJobs: photoDetails.processingJobs,
      };
    } catch (error) {
      console.error('Error fetching photo details:', error);
      // Fallback to original photo if details fetch fails
      photoToSelect = photo;
    }
    
    setSelectedPhoto(photoToSelect);
    setIsDrawerOpen(true);
    onPhotoSelect?.(photoToSelect);
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
      const error = err instanceof Error ? err : new Error(String(err));
      handleError(error, `Failed to ${action} photo`);
      throw error;
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
      
      // Start listening for SSE events on this job
      setActiveJobId(selectedPhoto.id);
      
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
      
      // Keep drawer open to show the updated photo when SSE completes
      
    } catch (err) {
      handleError(err as Error, 'Failed to start processing');
    }
  }, [selectedPhoto, userId, onProcessingComplete, handleError]);

  // Credit purchase and subscription are now handled globally

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" role="status" aria-live="polite">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cozy-accent mx-auto mb-4" aria-hidden="true"></div>
          <Body className="text-cozy-text">Loading your photos...</Body>
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
          <Headline level={3} className="text-cozy-heading mb-2">Something went wrong</Headline>
          <Body className="text-cozy-text mb-4">{error.message}</Body>
          {error.retryable && (
            <Button onClick={handleRefresh} variant="primary" aria-label="Retry loading photos">
              Try Again
            </Button>
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
          <div className="text-cozy-textSecondary text-6xl mb-4" aria-hidden="true">📸</div>
          <Headline level={3} className="text-cozy-heading mb-2">No photos yet</Headline>
          <Body className="text-cozy-text mb-4">Upload your first photo to get started</Body>
          <Button onClick={handleRefresh} variant="primary" aria-label="Refresh photo gallery">
            Refresh
          </Button>
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
              onPhotoUpdate={async (updatedPhoto) => {
                // Update the selected photo with fresh data from server
                try {
                  const photoDetails = await photoManagementService.getPhotoDetails(updatedPhoto.id);
                  setSelectedPhoto({
                    ...updatedPhoto,
                    ...photoDetails.photo,
                    results: photoDetails.results
                  });
                } catch (error) {
                  console.error('Error refreshing photo details:', error);
                  // Fallback to local update if refresh fails
                  setSelectedPhoto(updatedPhoto);
                }
              }}
            />
          </ErrorBoundary>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default PhotoManagementContainer;