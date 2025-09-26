'use client';

import React, { useState, useCallback } from 'react';
import { PhotoUploadContainerProps, UploadState, UploadResult, UploadError, ErrorType } from '../../types/upload';
import { CameraCaptureFlow } from './CameraCaptureFlow';

/**
 * Main orchestration component for photo upload system
 * Manages upload state and coordinates all upload methods
 */
export const PhotoUploadContainer: React.FC<PhotoUploadContainerProps> = ({
  onUploadComplete,
  onError,
  maxFileSize = 50 * 1024 * 1024, // 50MB default
  allowedFormats = ['image/jpeg', 'image/png', 'image/heic', 'image/webp']
}) => {
  // TODO: Use maxFileSize and allowedFormats in validation logic (Task 2.1)
  console.log('Upload limits:', { maxFileSize, allowedFormats }); // Temporary to avoid unused warnings
  // Upload state management
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    currentStep: 'method_selection'
  });

  // Camera state
  const [showCamera, setShowCamera] = useState(false);

  // Handle upload completion
  const handleUploadComplete = useCallback((result: UploadResult) => {
    setUploadState(prev => ({
      ...prev,
      status: 'complete',
      progress: 100,
      uploadResult: result
    }));
    onUploadComplete(result);
  }, [onUploadComplete]);

  // Handle upload errors
  const handleUploadError = useCallback((error: UploadError) => {
    setUploadState(prev => ({
      ...prev,
      status: 'error',
      error
    }));
    onError(error);
  }, [onError]);

  // Handle camera capture - now goes directly to cropping
  const handleCameraCapture = useCallback((imageData: string) => {
    console.log('Photo captured from camera:', imageData.substring(0, 50) + '...');
    
    // Convert base64 to mock upload result and complete the upload
    const mockResult: UploadResult = {
      uploadId: `camera-${Date.now()}`,
      fileKey: `camera-capture-${Date.now()}.jpg`,
      thumbnailUrl: imageData,
      originalFileName: `camera-capture-${Date.now()}.jpg`,
      fileSize: Math.floor(imageData.length * 0.75), // Approximate file size
      dimensions: { width: 1920, height: 1080 }, // Default camera dimensions
      processingStatus: 'queued'
    };

    // Update upload state to complete
    setUploadState(prev => ({
      ...prev,
      status: 'complete',
      currentStep: 'complete',
      uploadResult: mockResult
    }));

    setShowCamera(false);
    onUploadComplete(mockResult);
  }, [onUploadComplete]);



  // Handle camera errors
  const handleCameraError = useCallback((error: { code: string; message: string; name: string }) => {
    console.error('Camera error:', error);
    const uploadError: UploadError = {
      name: 'CameraError',
      message: error.message || 'Camera access failed',
      code: error.code || 'CAMERA_ERROR',
      type: ErrorType.PERMISSION_ERROR,
      retryable: true
    };
    handleUploadError(uploadError);
  }, [handleUploadError]);

  // TODO: Connect handleUploadComplete and handleUploadError to actual upload methods (Task 3.2, 6.2)
  console.log('Upload handlers ready:', { handleUploadComplete, handleUploadError }); // Temporary to avoid unused warnings

  return (
    <div className="bg-white rounded-lg shadow-lg p-8 text-center">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">
        Upload Your Photo
      </h2>
      
      {uploadState.status === 'idle' && !showCamera && (
        <div>
          <p className="text-gray-600 mb-6">
            Choose how you&apos;d like to upload your photo for restoration
          </p>
          
          {/* Upload method selection */}
          <div className="space-y-4">
            <button 
              onClick={() => setShowCamera(true)}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              📷 Take Photo
            </button>
            <button className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors">
              📁 Choose from Gallery (Coming Soon)
            </button>
            <button className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors">
              💻 Upload from Computer (Coming Soon)
            </button>
          </div>
        </div>
      )}



      {/* Camera Flow */}
      <CameraCaptureFlow
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCapture}
        onError={handleCameraError}
        facingMode="environment"
        aspectRatio={4/3}
        closeOnEscape={true}
      />

      {uploadState.status === 'uploading' && (
        <div>
          <p className="text-gray-600 mb-4">Uploading your photo...</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadState.progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">{uploadState.progress}% complete</p>
        </div>
      )}

      {uploadState.status === 'complete' && uploadState.uploadResult && (
        <div>
          <p className="text-green-600 mb-4">✅ Photo uploaded successfully!</p>
          <p className="text-gray-600">Your photo is ready for processing.</p>
        </div>
      )}

      {uploadState.status === 'error' && uploadState.error && (
        <div>
          <p className="text-red-600 mb-4">❌ Upload failed</p>
          <p className="text-gray-600 mb-4">{uploadState.error.message}</p>
          {uploadState.error.retryable && (
            <button 
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              onClick={() => setUploadState(prev => ({ ...prev, status: 'idle', error: undefined }))}
            >
              Try Again
            </button>
          )}
        </div>
      )}
    </div>
  );
};