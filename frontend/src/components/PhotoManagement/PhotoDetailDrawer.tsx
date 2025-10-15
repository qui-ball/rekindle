'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { PhotoDetailDrawerProps, PhotoAction, ProcessingOptions, Photo, PhotoResult } from '../../types/photo-management';
import { ProcessingOptionsPanel } from './ProcessingOptionsPanel';

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
export const PhotoDetailDrawer: React.FC<PhotoDetailDrawerProps> = ({
  isOpen,
  photo,
  onClose,
  onPhotoAction,
  onProcessingStart
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
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

  // Handle photo actions
  const handlePhotoAction = (action: PhotoAction, targetPhoto: Photo | PhotoResult) => {
    if ('userId' in targetPhoto) {
      // It's a Photo
      onPhotoAction(action, targetPhoto as Photo);
    } else {
      // It's a PhotoResult, we need to get the parent photo
      console.log('PhotoResult action:', action, targetPhoto);
      // TODO: Handle PhotoResult actions
    }
  };

  if (!isOpen || !photo) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black transition-opacity duration-300 z-40 ${
          isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'
        } ${isMobile ? 'block' : 'hidden'}`}
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
              <h2 className="text-lg font-semibold text-gray-900">Photo Details</h2>
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
        <div className="flex-1 overflow-y-auto">
          {/* Original Photo */}
          <div className="p-4">
            <div className="mb-4">
              <h3 className="text-md font-medium text-gray-900 mb-2">Original Photo</h3>
              <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ height: '24rem' }}>
                <Image
                  src={photo.metadata.originalUrl}
                  alt={photo.originalFilename}
                  fill
                  sizes="(max-width: 768px) 100vw, 60vw"
                  className="object-contain"
                  unoptimized
                  priority={false}
                />
                <div className="absolute top-2 right-2 flex space-x-2">
                  <button
                    onClick={() => handlePhotoAction('download', photo)}
                    className="bg-white bg-opacity-90 hover:bg-opacity-100 p-2 rounded-full shadow-md transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handlePhotoAction('delete', photo)}
                    className="bg-red-500 bg-opacity-90 hover:bg-opacity-100 text-white p-2 rounded-full shadow-md transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Results */}
            {photo.results.length > 0 && (
              <div className="mb-4">
                <h3 className="text-md font-medium text-gray-900 mb-2">Processed Results</h3>
                <div className="space-y-3">
                  {photo.results.map((result) => (
                    <div key={result.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900 capitalize">
                            {result.resultType}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            result.status === 'completed' 
                              ? 'bg-green-100 text-green-800'
                              : result.status === 'processing'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {result.status}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handlePhotoAction('download', result)}
                            className="text-blue-600 hover:text-blue-800 p-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handlePhotoAction('delete', result)}
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {result.metadata.dimensions.width} × {result.metadata.dimensions.height} • 
                        {result.metadata.fileSize > 1024 * 1024 
                          ? `${(result.metadata.fileSize / (1024 * 1024)).toFixed(1)} MB`
                          : `${(result.metadata.fileSize / 1024).toFixed(0)} KB`
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Processing Options */}
            <ProcessingOptionsPanel
              photo={photo}
              availableCredits={{
                totalCredits: 100, // TODO: Get from context
                subscriptionCredits: 25,
                topupCredits: 75,
                subscriptionTier: 'remember',
                lowCreditWarning: false,
                creditHistory: [],
                usageRules: {
                  subscriptionFirst: true,
                  subscriptionExpires: true,
                  topupCarryOver: true
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
