'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { PhotoDetailDrawerProps, ProcessingOptions, PhotoResult } from '../../types/photo-management';
import { ProcessingOptionsPanel } from './ProcessingOptionsPanel';
import { PhotoResultCard } from './PhotoResultCard';
import { apiClient } from '../../services/apiClient';
import { Headline, Body, PhotoMount } from '@/components/ui';

/**
 * PhotoDetailDrawer Component
 * 
 * Contextual drawer component for displaying photo details and associated results.
 * Features:
 * - Mobile: Full-screen overlay drawer that slides in from right, covers entire screen
 * - Desktop: Side panel drawer that slides in from right, covers ~60% of screen width
 * - Display original photo and all associated results
 * - Individual file actions (download, delete) for each result
 * - Processing options panel integration
 * - Swipe-to-close gesture on mobile, click-outside-to-close on desktop
 */

// Add styles for hiding scrollbar
const scrollbarHideStyles = `
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / 1024).toFixed(0)} KB`;
};
export const PhotoDetailDrawer: React.FC<PhotoDetailDrawerProps> = ({
  isOpen,
  photo,
  onClose,
  onPhotoAction,
  onProcessingStart,
  onPhotoUpdate
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  // Index of the currently selected carousel item:
  // 0 = original photo, 1..n = processed results
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const resultsContainerRef = React.useRef<HTMLDivElement>(null);

  // Reset selection when photo changes
  useEffect(() => {
    setCurrentItemIndex(0);
  }, [photo?.id]);

  // Scroll to specific carousel item with smooth animation
  const scrollToItem = (index: number) => {
    if (!resultsContainerRef.current) return;
    const container = resultsContainerRef.current;
    const cardWidth = container.offsetWidth;
    container.scrollTo({
      left: index * cardWidth,
      behavior: 'smooth'
    });
  };

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle keyboard and mouse events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        onClose();
      }
      
      // Handle scroll with arrow keys and page up/down
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || 
          e.key === 'PageUp' || e.key === 'PageDown' || 
          e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        const drawerContent = document.querySelector('.drawer-content');
        if (drawerContent) {
          const scrollAmount = e.key === 'ArrowUp' ? -50 : 
                              e.key === 'ArrowDown' ? 50 :
                              e.key === 'PageUp' ? -300 :
                              e.key === 'PageDown' ? 300 :
                              e.key === 'Home' ? -drawerContent.scrollTop :
                              drawerContent.scrollHeight;
          
          drawerContent.scrollBy({ top: scrollAmount, behavior: 'smooth' });
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (!isOpen) return;
      
      // Allow native scrolling for the drawer content
      const drawerContent = document.querySelector('.drawer-content');
      if (drawerContent && drawerContent.contains(e.target as Node)) {
        // Let the native scroll handle it
        return;
      }
      
      // For other areas, prevent default and scroll the drawer content
      e.preventDefault();
      if (drawerContent) {
        drawerContent.scrollBy({ top: e.deltaY, behavior: 'auto' });
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('wheel', handleWheel);
      };
    }
  }, [isOpen, onClose]);

  // Handle processing start
  const handleProcessingStart = async (options: ProcessingOptions) => {
    if (!photo) return;

    // Determine which item is currently selected in the carousel
    const isOriginalSelected = currentItemIndex === 0;
    const selectedResult: PhotoResult | undefined =
      !isOriginalSelected && photo.results.length > 0
        ? photo.results[currentItemIndex - 1]
        : undefined;

    // Attach selection context to processing parameters so the backend
    // can distinguish between processing the original vs a prior result.
    const enhancedOptions: ProcessingOptions = {
      ...options,
      parameters: {
        ...options.parameters,
        restore: {
          colourize: options.parameters?.restore?.colourize ?? false,
          denoiseLevel: options.parameters?.restore?.denoiseLevel,
          userPrompt: options.parameters?.restore?.userPrompt,
          // Optional ID of the source result when re-processing
          sourceResultId: selectedResult?.id
        },
        animate: options.parameters?.animate,
        bringTogether: options.parameters?.bringTogether
      }
    };

    setIsProcessing(true);
    try {
      await onProcessingStart(enhancedOptions);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle download for original photo
  const handleDownloadOriginal = async () => {
    if (!photo) return;
    
    try {
      // Fetch the presigned URL for download
      const response = await fetch(`/api/v1/photos/${photo.id}/download-url?key_type=original`);
      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }

      const data = await response.json();
      
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = data.url;
      link.download = photo.originalFilename || `photo-${photo.id}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading photo:', error);
      alert('Failed to download photo. Please try again.');
    }
  };

  // Handle delete for original photo
  const handleDeleteOriginal = async () => {
    if (!photo) return;
    
    if (!confirm('Are you sure you want to delete this photo? This will also delete all associated results.')) {
      return;
    }

    try {
      await onPhotoAction('delete', photo);
      onClose();
    } catch (error) {
      console.error('Error deleting photo:', error);
      alert('Failed to delete photo. Please try again.');
    }
  };

  // Handle download for result
  const handleDownloadResult = async (result: PhotoResult) => {
    try {
      // Fetch the job data to get the presigned URL using authenticated API client
      const jobData = await apiClient.get<{
        restore_attempts?: Array<{
          id: string;
          url?: string;
        }>;
      }>(`/v1/jobs/${result.photoId}`);
      
      // Find the matching restore attempt
      const restoreAttempt = jobData.restore_attempts?.find(
        (attempt: { id: string }) => attempt.id === result.id
      );

      if (!restoreAttempt?.url) {
        throw new Error('Result URL not found');
      }

      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = restoreAttempt.url;
      link.download = `${result.resultType}-${result.id}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading result:', error);
      throw error; // Re-throw to be handled by PhotoResultCard
    }
  };

  // Handle delete for result
  const handleDeleteResult = async (result: PhotoResult) => {
    try {
      // Delete the restore attempt using authenticated API client
      await apiClient.delete(`/v1/jobs/${result.photoId}/restore/${result.id}`);

      // Refresh photo details from server to get updated results
      if (photo) {
        const { photoManagementService } = await import('../../services/photoManagementService');
        const photoDetails = await photoManagementService.getPhotoDetails(photo.id);
        
        // Adjust current carousel index if needed (keep selection in bounds)
        const updatedResults = photoDetails.results;
        const maxIndex = 1 + updatedResults.length - 1; // 0 = original, then results
        if (currentItemIndex > maxIndex) {
          setCurrentItemIndex(Math.max(0, maxIndex));
        }
        
        // Notify parent to update the photo with fresh data
        if (onPhotoUpdate) {
          onPhotoUpdate({
            ...photo,
            ...photoDetails.photo,
            results: photoDetails.results
          });
        }
      }
    } catch (error) {
      console.error('Error deleting result:', error);
      throw error; // Re-throw to be handled by PhotoResultCard
    }
  };

  if (!isOpen || !photo) return null;

  return (
    <>
      {/* Inject scrollbar hide styles */}
      <style dangerouslySetInnerHTML={{ __html: scrollbarHideStyles }} />
      
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black transition-opacity duration-300 z-40 ${
          isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'
        } ${isMobile ? 'block' : 'block'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full bg-cozy-surface border border-cozy-borderCard border-r-0 shadow-cozy-card transition-transform duration-300 z-50 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } ${isMobile ? 'w-full rounded-none' : 'w-3/5 max-w-2xl rounded-cozy-lg rounded-r-none'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cozy-borderCard">
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="p-2 hover:bg-cozy-mount rounded-full transition-colors text-cozy-text"
              aria-label="Close"
            >
              {isMobile ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
            <div>
              <Headline level={2} className="text-cozy-heading">
                {isMobile ? 'Back to Gallery' : 'Photo Details'}
              </Headline>
              <Body className="text-sm text-cozy-text">{photo.originalFilename}</Body>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-cozy-text">
              {new Date(photo.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto drawer-content" style={{ maxHeight: 'calc(100vh - 80px)' }}>
          <div className="p-4">
            {/* Unified Photo & Results Carousel */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <Headline level={3} className="text-cozy-heading">
                    Photo & Results
                  </Headline>
                  <Body className="text-xs text-cozy-textSecondary">
                    {currentItemIndex === 0 ? 'Original photo selected' : 'Processed result selected'}
                  </Body>
                </div>
                <span className="text-sm text-cozy-textSecondary">
                  {currentItemIndex + 1} / {1 + photo.results.length}
                </span>
              </div>

              <div
                ref={resultsContainerRef}
                data-testid="results-container"
                className="hide-scrollbar flex overflow-hidden -mx-4 cursor-grab active:cursor-grabbing"
                style={{
                  touchAction: 'auto', // Allow both directions, JavaScript will handle detection
                  userSelect: 'none'
                }}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent text selection
                  const startX = e.clientX;
                  const container = resultsContainerRef.current;
                  if (!container) return;

                  let moved = false;

                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    if (moved) return;

                    const deltaX = startX - moveEvent.clientX;
                    const threshold = 50; // Minimum drag distance

                    if (Math.abs(deltaX) > threshold) {
                      moved = true;

                      const totalItems = 1 + photo.results.length;

                      if (deltaX > 0 && currentItemIndex < totalItems - 1) {
                        // Drag left - next item
                        const nextIndex = currentItemIndex + 1;
                        setCurrentItemIndex(nextIndex);
                        scrollToItem(nextIndex);
                      } else if (deltaX < 0 && currentItemIndex > 0) {
                        // Drag right - previous item
                        const prevIndex = currentItemIndex - 1;
                        setCurrentItemIndex(prevIndex);
                        scrollToItem(prevIndex);
                      }

                      cleanup();
                    }
                  };

                  const handleMouseUp = () => {
                    cleanup();
                  };

                  const cleanup = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                  };

                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                }}
                onTouchStart={(e) => {
                  const touch = e.touches[0];
                  const startX = touch.clientX;
                  const startY = touch.clientY;
                  const container = resultsContainerRef.current;
                  if (!container) return;

                  let moved = false;
                  let swipeDirection: 'horizontal' | 'vertical' | null = null;

                  const handleTouchMove = (moveEvent: TouchEvent) => {
                    if (moved) return;

                    const currentTouch = moveEvent.touches[0];
                    const deltaX = startX - currentTouch.clientX;
                    const deltaY = startY - currentTouch.clientY;

                    // Determine swipe direction on first significant movement
                    if (swipeDirection === null) {
                      const absDeltaX = Math.abs(deltaX);
                      const absDeltaY = Math.abs(deltaY);

                      if (absDeltaX > 10 || absDeltaY > 10) {
                        // Determine if this is primarily horizontal or vertical
                        if (absDeltaX > absDeltaY) {
                          swipeDirection = 'horizontal';
                          // Prevent default to stop vertical scrolling during horizontal swipe
                          moveEvent.preventDefault();
                        } else {
                          swipeDirection = 'vertical';
                          // This is a vertical scroll, clean up and let it through
                          cleanup();
                          return;
                        }
                      }
                    }

                    // Only handle horizontal swipes
                    if (swipeDirection === 'horizontal') {
                      // Continue preventing default for horizontal swipes
                      moveEvent.preventDefault();

                      const threshold = 50; // Minimum swipe distance
                      if (Math.abs(deltaX) > threshold) {
                        moved = true;

                        const totalItems = 1 + photo.results.length;

                        if (deltaX > 0 && currentItemIndex < totalItems - 1) {
                          // Swipe left - next item
                          const nextIndex = currentItemIndex + 1;
                          setCurrentItemIndex(nextIndex);
                          scrollToItem(nextIndex);
                        } else if (deltaX < 0 && currentItemIndex > 0) {
                          // Swipe right - previous item
                          const prevIndex = currentItemIndex - 1;
                          setCurrentItemIndex(prevIndex);
                          scrollToItem(prevIndex);
                        }

                        // Clean up listeners
                        cleanup();
                      }
                    }
                  };

                  const handleTouchEnd = () => {
                    cleanup();
                  };

                  const cleanup = () => {
                    container.removeEventListener('touchmove', handleTouchMove);
                    container.removeEventListener('touchend', handleTouchEnd);
                    container.removeEventListener('touchcancel', handleTouchEnd);
                  };

                  // Use passive: false to allow preventDefault for horizontal swipes
                  container.addEventListener('touchmove', handleTouchMove, { passive: false });
                  container.addEventListener('touchend', handleTouchEnd, { passive: true });
                  container.addEventListener('touchcancel', handleTouchEnd, { passive: true });
                }}
              >
                {/* First item: Original photo */}
                <div
                  key="original"
                  className="snap-center flex-shrink-0 px-4"
                  style={{ width: '100%' }}
                >
                  <PhotoMount design="default" aspectRatio="4/3" className="rounded-cozy-lg">
                    <div className="absolute inset-0 min-h-[300px]">
                      {photo.metadata.originalUrl ? (
                        <Image
                          src={photo.metadata.originalUrl}
                          alt={photo.originalFilename}
                          fill
                          sizes="(max-width: 768px) 100vw, 60vw"
                          className="object-contain"
                          unoptimized
                          priority={false}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-cozy-surface border border-cozy-borderCard flex items-center justify-center">
                          <div className="text-center text-cozy-textSecondary">
                            <svg className="w-12 h-12 mx-auto mb-2 text-cozy-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <Body className="text-sm">Loading image...</Body>
                          </div>
                        </div>
                      )}

                      {/* Original photo actions */}
                      <div className="absolute top-2 right-2 flex space-x-2">
                        <button
                          onClick={handleDownloadOriginal}
                          className="bg-cozy-surface/90 hover:bg-cozy-surface border border-cozy-borderCard p-2 rounded-full shadow-cozy-card transition-all text-cozy-text"
                          title="Download original photo"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                        <button
                          onClick={handleDeleteOriginal}
                          className="bg-cozySemantic-error/90 hover:opacity-100 text-white p-2 rounded-full shadow-cozy-card transition-all"
                          title="Delete photo and all results"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>

                      {/* Original badge */}
                      <div className="absolute bottom-2 left-2">
                        <span className="px-3 py-1 text-xs font-medium rounded-full bg-cozy-mount/90 text-cozy-heading border border-cozy-borderCard">
                          Original photo
                        </span>
                      </div>
                    </div>
                  </PhotoMount>

                  {/* Original photo metadata (mirrors processed result details) */}
                  <div className="mt-2 text-xs text-cozy-textSecondary space-y-1">
                    <div className="font-medium text-cozy-heading">
                      {photo.metadata.dimensions.width} × {photo.metadata.dimensions.height}
                    </div>
                    <div>
                      {formatFileSize(photo.metadata.fileSize)} • {photo.metadata.format.toUpperCase()}
                    </div>
                    <div className="text-cozy-textMuted">
                      {new Date(photo.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Following items: processed results */}
                {photo.results.map((result) => (
                  <div
                    key={result.id}
                    className="snap-center flex-shrink-0 px-4"
                    style={{ width: '100%' }}
                  >
                    <PhotoResultCard
                      result={result}
                      onDownload={handleDownloadResult}
                      onDelete={handleDeleteResult}
                    />
                  </div>
                ))}
              </div>

              {/* Pagination Dots (for all items incl. original) */}
              {1 + photo.results.length > 1 && (
                <div className="flex justify-center mt-3 space-x-2">
                  {Array.from({ length: 1 + photo.results.length }).map((_, index) => (
                    <div
                      key={index}
                      className={`h-2 w-2 rounded-full transition-all ${
                        index === currentItemIndex
                          ? 'bg-cozy-accent w-6'
                          : 'bg-cozy-borderCard'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Guidance when no results yet */}
            {photo.results.length === 0 && (
              <Body className="text-xs text-cozy-textSecondary mb-3">
                Use the processing options below to restore, colourise, or animate this photo.
              </Body>
            )}

            {/* Processing Options */}
            <ProcessingOptionsPanel
              photo={photo}
              availableCredits={{
                totalCredits: 100, // Mock credit data
                subscriptionTier: 'remember',
                lowCreditWarning: false,
                creditHistory: [],
                usageRules: {
                  creditsCarryOver: true,
                  lostOnCancellation: true
                }
              }}
              onOptionsChange={() => {}}
              onProcess={handleProcessingStart}
              isProcessing={isProcessing}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default PhotoDetailDrawer;
