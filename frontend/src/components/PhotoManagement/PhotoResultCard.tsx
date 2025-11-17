'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { PhotoResult } from '../../types/photo-management';
import { apiClient } from '../../services/apiClient';

/**
 * PhotoResultCard Component
 * 
 * Displays an individual photo processing result with:
 * - Result image (or video for animated results)
 * - Loading states and error handling
 * - Status indicators
 * - Download and delete action buttons
 */

interface PhotoResultCardProps {
  result: PhotoResult;
  onDownload: (result: PhotoResult) => void;
  onDelete: (result: PhotoResult) => void;
}

export const PhotoResultCard: React.FC<PhotoResultCardProps> = ({
  result,
  onDownload,
  onDelete
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch presigned URL for the result
  useEffect(() => {
    const fetchResultUrl = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        // If we have a fileKey, fetch the presigned URL from the backend
        if (result.fileKey && result.fileKey !== 'pending' && result.fileKey !== 'failed') {
          // Use authenticated API client
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

          if (restoreAttempt?.url) {
            setImageUrl(restoreAttempt.url);
          } else {
            throw new Error('Result URL not found');
          }
        } else {
          // Result is still processing or failed
          setImageUrl(null);
        }
      } catch (error) {
        console.error('Error fetching result URL:', error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResultUrl();
  }, [result.id, result.photoId, result.fileKey]);

  // Handle delete action
  const handleDelete = async () => {
    if (isDeleting) return;
    
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete this ${result.resultType} result?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(result);
    } catch (error) {
      console.error('Error deleting result:', error);
      alert('Failed to delete result. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle download action
  const handleDownload = async () => {
    try {
      await onDownload(result);
    } catch (error) {
      console.error('Error downloading result:', error);
      alert('Failed to download result. Please try again.');
    }
  };

  // Get status color
  const getStatusColor = () => {
    switch (result.status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-orange-100 text-orange-800 animate-pulse';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get result type display name
  const getResultTypeName = () => {
    switch (result.resultType) {
      case 'restored':
        return 'Restored';
      case 'colourized':
        return 'Colourized';
      case 'animated':
        return 'Animated';
      case 'combined':
        return 'Combined';
      default:
        return result.resultType.charAt(0).toUpperCase() + result.resultType.slice(1);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <div className="flex-shrink-0 w-full bg-white rounded-lg overflow-hidden">
      {/* Result Image/Video Display with Overlaid Actions */}
      <div className="relative bg-gray-200" style={{ aspectRatio: '4/3', minHeight: '300px' }}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <svg 
                className="animate-spin h-8 w-8 mx-auto mb-2 text-gray-400" 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24"
              >
                <circle 
                  className="opacity-25" 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="4"
                />
                <path 
                  className="opacity-75" 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p className="text-sm">Loading result...</p>
            </div>
          </div>
        )}

        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-red-500">
              <svg 
                className="w-12 h-12 mx-auto mb-2" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <p className="text-sm">Failed to load result</p>
            </div>
          </div>
        )}

        {!isLoading && !hasError && imageUrl && result.resultType !== 'animated' && (
          <Image
            src={imageUrl}
            alt={`${getResultTypeName()} result`}
            fill
            sizes="(max-width: 768px) 100vw, 60vw"
            className="object-contain"
            unoptimized
            onError={() => setHasError(true)}
          />
        )}

        {!isLoading && !hasError && imageUrl && result.resultType === 'animated' && (
          <video
            src={imageUrl}
            className="w-full h-full object-contain"
            controls
            loop
            onError={() => setHasError(true)}
          >
            Your browser does not support video playback.
          </video>
        )}

        {!isLoading && !hasError && !imageUrl && result.status === 'processing' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <svg 
                className="animate-spin h-8 w-8 mx-auto mb-2 text-blue-500" 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24"
              >
                <circle 
                  className="opacity-25" 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="4"
                />
                <path 
                  className="opacity-75" 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p className="text-sm font-medium">Processing...</p>
            </div>
          </div>
        )}

        {/* Overlaid Action Buttons (Top Right) */}
        {imageUrl && result.status === 'completed' && (
          <div className="absolute top-2 right-2 flex space-x-2">
            <button
              onClick={handleDownload}
              className="bg-white bg-opacity-90 hover:bg-opacity-100 p-2 rounded-full shadow-md transition-all"
              title="Download result"
            >
              <svg 
                className="w-4 h-4 text-gray-700" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" 
                />
              </svg>
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-500 bg-opacity-90 hover:bg-opacity-100 text-white p-2 rounded-full shadow-md transition-all disabled:opacity-50"
              title="Delete result"
            >
              {isDeleting ? (
                <svg 
                  className="animate-spin h-4 w-4" 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24"
                >
                  <circle 
                    className="opacity-25" 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke="currentColor" 
                    strokeWidth="4"
                  />
                  <path 
                    className="opacity-75" 
                    fill="currentColor" 
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg 
                  className="w-4 h-4" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                  />
                </svg>
              )}
            </button>
          </div>
        )}

        {/* Status Badge (Bottom Left) */}
        <div className="absolute bottom-2 left-2">
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor()}`}>
            {getResultTypeName()}
          </span>
        </div>
      </div>

      {/* Result Metadata (Below Image) */}
      <div className="p-3 bg-white">
        <div className="text-xs text-gray-500 space-y-1">
          <div className="font-medium text-gray-700">
            {result.metadata.dimensions.width} × {result.metadata.dimensions.height}
          </div>
          <div>
            {formatFileSize(result.metadata.fileSize)} • {result.metadata.format.toUpperCase()}
          </div>
          {result.completedAt && (
            <div className="text-gray-400">
              {new Date(result.completedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhotoResultCard;
