'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { PhotoDetailDrawerProps, PhotoAction, ProcessingOptions, Photo, PhotoResult } from '../../types/photo-management';
import { ProcessingOptionsPanel } from './ProcessingOptionsPanel';
import { PhotoResultCard } from './PhotoResultCard';

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
export const PhotoDetailDrawer: React.FC<PhotoDetailDrawerProps> = ({
  isOpen,
  photo,
  onClose,
  onPhotoAction,
  onProcessingStart
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const resultsContainerRef = React.useRef<HTMLDivElement>(null);

  // Reset result index when photo changes
  useEffect(() => {
    setCurrentResultIndex(0);
  }, [photo?.id]);

  // Scroll to specific result with smooth animation
  const scrollToResult = (index: number) => {
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
    setIsProcessing(true);
    try {
      await onProcessingStart(options);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle download for original photo
  const handleDownloadOriginal = async () => {
    if (!photo) return;
    
    try {
      // Fetch the presigned URL for download
      const response = await fetch(`/api/v1/jobs/${photo.id}/image-url`);
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
      const response = await fetch(`/api/v1/jobs/${photo.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete photo');
      }

      // Close drawer and notify parent
      onClose();
      onPhotoAction('delete', photo);
    } catch (error) {
      console.error('Error deleting photo:', error);
      alert('Failed to delete photo. Please try again.');
    }
  };

  // Handle download for result
  const handleDownloadResult = async (result: PhotoResult) => {
    try {
      // Fetch the job data to get the presigned URL
      const response = await fetch(`/api/v1/jobs/${result.photoId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch result URL');
      }

      const jobData = await response.json();
      
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
      // For now, we'll delete the entire restore attempt
      // In the future, this should be updated to delete only the specific result
      const response = await fetch(`/api/v1/jobs/${result.photoId}/restore/${result.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete result');
      }

      // Reload the photo data to reflect the deletion
      // TODO: Implement a more efficient way to update the local state
      window.location.reload();
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
        className={`fixed top-0 right-0 h-full bg-white shadow-xl transition-transform duration-300 z-50 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } ${isMobile ? 'w-full' : 'w-3/5 max-w-2xl'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
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
              <h2 className="text-lg font-semibold text-gray-900">
                {isMobile ? 'Back to Gallery' : 'Photo Details'}
              </h2>
              <p className="text-sm text-gray-500">{photo.originalFilename}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {new Date(photo.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto drawer-content" style={{ maxHeight: 'calc(100vh - 80px)' }}>
          {/* Original Photo */}
          <div className="p-4">
            <div className="mb-4">
              <h3 className="text-md font-medium text-gray-900 mb-2">Original Photo</h3>
              <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ height: '24rem' }}>
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
                  <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm">Loading image...</p>
                    </div>
                  </div>
                )}
                <div className="absolute top-2 right-2 flex space-x-2">
                  <button
                    onClick={handleDownloadOriginal}
                    className="bg-white bg-opacity-90 hover:bg-opacity-100 p-2 rounded-full shadow-md transition-all"
                    title="Download original photo"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  <button
                    onClick={handleDeleteOriginal}
                    className="bg-red-500 bg-opacity-90 hover:bg-opacity-100 text-white p-2 rounded-full shadow-md transition-all"
                    title="Delete photo and all results"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Results - Full-Width Horizontal Swiper */}
            {photo.results.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-md font-medium text-gray-900">
                    Processed Results
                  </h3>
                  <span className="text-sm text-gray-500">
                    {currentResultIndex + 1} / {photo.results.length}
                  </span>
                </div>
                <div 
                  ref={resultsContainerRef}
                  className="hide-scrollbar flex overflow-hidden -mx-4"
                  style={{
                    touchAction: 'pan-y', // Allow vertical scrolling, block horizontal
                    userSelect: 'none'
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
                        const threshold = 50; // Minimum swipe distance
                        if (Math.abs(deltaX) > threshold) {
                          moved = true;
                          
                          if (deltaX > 0 && currentResultIndex < photo.results.length - 1) {
                            // Swipe left - next result
                            const nextIndex = currentResultIndex + 1;
                            setCurrentResultIndex(nextIndex);
                            scrollToResult(nextIndex);
                          } else if (deltaX < 0 && currentResultIndex > 0) {
                            // Swipe right - previous result
                            const prevIndex = currentResultIndex - 1;
                            setCurrentResultIndex(prevIndex);
                            scrollToResult(prevIndex);
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

                    // Use passive: true to allow smooth scrolling
                    container.addEventListener('touchmove', handleTouchMove, { passive: true });
                    container.addEventListener('touchend', handleTouchEnd, { passive: true });
                    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });
                  }}
                >
                  {photo.results.map((result, index) => (
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
                {/* Pagination Dots */}
                {photo.results.length > 1 && (
                  <div className="flex justify-center mt-3 space-x-2">
                    {photo.results.map((_, index) => (
                      <div 
                        key={index} 
                        className={`h-2 w-2 rounded-full transition-all ${
                          index === currentResultIndex 
                            ? 'bg-blue-500 w-6' 
                            : 'bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Empty Results State */}
            {photo.results.length === 0 && (
              <div className="mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <svg 
                    className="w-12 h-12 mx-auto mb-2 text-blue-400" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
                    />
                  </svg>
                  <h4 className="text-sm font-medium text-gray-900 mb-1">No processed results yet</h4>
                  <p className="text-xs text-gray-600">
                    Use the processing options below to restore, colourize, or animate this photo
                  </p>
                </div>
              </div>
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
