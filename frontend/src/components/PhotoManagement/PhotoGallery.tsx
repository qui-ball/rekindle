'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { PhotoGalleryProps, Photo, ProcessingStatus } from '../../types/photo-management';
import { PhotoStatusIndicator } from './PhotoStatusIndicator';

/**
 * PhotoGallery Component
 * 
 * Grid-based photo display with status indicators and touch-optimized interactions.
 * Features:
 * - Responsive grid layout (2-4 columns based on screen size)
 * - Touch-optimized photo thumbnails with status overlays
 * - Infinite scroll with pull-to-refresh on mobile
 * - Smooth loading animations and skeleton states
 * - Status indicators for processing states
 */
export const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  photos,
  onPhotoClick,
  onLoadMore,
  hasMore,
  isLoading,
  onRefresh,
  isRefreshing
}) => {
  const [, setIsScrolling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  
  const galleryRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pullStartRef = useRef<{ y: number; timestamp: number } | null>(null);

  // Handle infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (!galleryRef.current || isLoading || !hasMore) return;
      
      const { scrollTop, scrollHeight, clientHeight } = galleryRef.current;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;
      
      if (isNearBottom) {
        onLoadMore();
      }
    };

    const gallery = galleryRef.current;
    if (gallery) {
      gallery.addEventListener('scroll', handleScroll);
      return () => gallery.removeEventListener('scroll', handleScroll);
    }
  }, [onLoadMore, isLoading, hasMore]);

  // Handle pull-to-refresh on mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (galleryRef.current?.scrollTop === 0) {
      pullStartRef.current = {
        y: e.touches[0].clientY,
        timestamp: Date.now()
      };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pullStartRef.current || isRefreshing) return;
    
    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, currentY - pullStartRef.current.y);
    
    if (distance > 0) {
      setIsPulling(true);
      setPullDistance(Math.min(distance, 100));
      e.preventDefault();
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(() => {
    if (!pullStartRef.current || !isPulling) return;
    
    const shouldRefresh = pullDistance > 50;
    setIsPulling(false);
    setPullDistance(0);
    pullStartRef.current = null;
    
    if (shouldRefresh && onRefresh) {
      onRefresh();
    }
  }, [pullDistance, isPulling, onRefresh]);

  // Handle scroll state for performance
  const handleScroll = useCallback(() => {
    setIsScrolling(true);
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
  }, []);

  // Cleanup scroll timeout
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Get grid columns based on screen size
  const getGridColumns = () => {
    if (typeof window === 'undefined') return 'grid-cols-2';
    
    const width = window.innerWidth;
    if (width < 480) return 'grid-cols-1'; // Small mobile
    if (width < 640) return 'grid-cols-2'; // Mobile
    if (width < 1024) return 'grid-cols-3'; // Tablet
    return 'grid-cols-4'; // Desktop
  };

  // Map backend photo status to UI processing status
  const mapPhotoStatusToProcessingStatus = (status: Photo['status']): ProcessingStatus => {
    switch (status) {
      case 'uploaded':
        return 'ready';
      case 'processing':
        return 'processing';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      default:
        return 'ready';
    }
  };

  // Render photo thumbnail
  const renderPhotoThumbnail = (photo: Photo) => {
    const isProcessing = photo.status === 'processing' || photo.status === 'uploaded';
    const hasResults = photo.results.length > 0;
    
    return (
      <div
        key={photo.id}
        className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer group hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95 touch-manipulation"
        onClick={() => onPhotoClick(photo)}
        role="gridcell"
        tabIndex={0}
        aria-label={`Photo: ${photo.originalFilename}. Status: ${photo.status}. ${photo.results.length} results available.`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPhotoClick(photo);
          }
        }}
        style={{ 
          minHeight: '120px', // Ensure minimum touch target size
          minWidth: '120px'
        }}
      >
        {/* Photo Image */}
        <div className="relative w-full h-full">
          <Image
            src={photo.metadata.thumbnailUrl}
            alt={photo.originalFilename}
            fill
            sizes="(max-width: 480px) 100vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
            onError={() => {
              // Next/Image does not allow changing src on error; render fallback overlay
            }}
            unoptimized
            priority={false}
          />
          
          {/* Overlay for processing state */}
          {isProcessing && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="text-white text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                <p className="text-sm">Processing...</p>
              </div>
            </div>
          )}
        </div>

        {/* Status Indicator */}
        <PhotoStatusIndicator
          status={mapPhotoStatusToProcessingStatus(photo.status)}
          progress={isProcessing ? undefined : 100}
          onRetry={photo.status === 'failed' ? () => console.log('Retry photo:', photo.id) : undefined}
        />

        {/* Results Badge */}
        {hasResults && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
            {photo.results.length} result{photo.results.length !== 1 ? 's' : ''}
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="bg-white bg-opacity-90 rounded-full p-2">
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render skeleton loading state
  const renderSkeleton = () => (
    <div className="aspect-square bg-gray-200 rounded-lg animate-pulse">
      <div className="w-full h-full bg-gray-300 rounded-lg"></div>
    </div>
  );

  return (
    <div className="photo-gallery">
      {/* Pull-to-refresh indicator */}
      {isPulling && (
        <div 
          className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white text-center py-2 transition-transform duration-200"
          style={{ transform: `translateY(${Math.min(pullDistance - 50, 50)}px)` }}
        >
          {pullDistance > 50 ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      )}

      {/* Gallery Grid */}
      <div
        ref={galleryRef}
        className={`grid ${getGridColumns()} gap-4 p-4 min-h-screen`}
        role="grid"
        aria-label="Photo gallery grid"
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Photos */}
        {photos.map(renderPhotoThumbnail)}
        
        {/* Loading skeletons */}
        {isLoading && Array.from({ length: 8 }).map((_, index) => (
          <div key={`skeleton-${index}`}>
            {renderSkeleton()}
          </div>
        ))}
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex justify-center py-8" role="status" aria-live="polite">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" aria-hidden="true"></div>
            <span className="text-gray-600">Loading more photos...</span>
          </div>
        </div>
      )}

      {/* End of photos indicator */}
      {!hasMore && photos.length > 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>You&apos;ve reached the end of your photos</p>
        </div>
      )}

      {/* Empty state */}
      {photos.length === 0 && !isLoading && (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="text-gray-400 text-6xl mb-4">📸</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No photos yet</h3>
            <p className="text-gray-600">Upload your first photo to get started</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoGallery;
