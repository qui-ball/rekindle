'use client';

import React, { useState, useCallback } from 'react';
import { PhotoUploadContainerProps, UploadState, UploadResult, UploadError, ErrorType } from '../../types/upload';
import { CameraCapture } from './CameraCapture';

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
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

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

  // Handle camera capture
  const handleCameraCapture = useCallback((imageData: string) => {
    console.log('Photo captured from camera:', imageData.substring(0, 50) + '...');
    
    // Store the captured image and show preview
    setCapturedImage(imageData);
    setShowCamera(false);
    
    // Update upload state to show we have a selected file
    setUploadState(prev => ({
      ...prev,
      status: 'idle',
      currentStep: 'cropping',
      selectedFile: undefined // Will be properly typed when File handling is implemented
    }));
  }, []);

  // Handle proceeding with the captured image (for future cropping step)
  const handleProceedWithImage = useCallback(() => {
    if (!capturedImage) return;
    
    // Convert base64 to mock upload result for now
    const mockResult: UploadResult = {
      uploadId: `camera-${Date.now()}`,
      fileKey: `camera-capture-${Date.now()}.jpg`,
      thumbnailUrl: capturedImage,
      originalFileName: `camera-capture-${Date.now()}.jpg`,
      fileSize: Math.floor(capturedImage.length * 0.75), // Approximate file size
      dimensions: { width: 1920, height: 1080 }, // Default camera dimensions
      processingStatus: 'queued'
    };
    
    handleUploadComplete(mockResult);
  }, [capturedImage, handleUploadComplete]);

  // Handle retaking photo
  const handleRetakePhoto = useCallback(() => {
    setCapturedImage(null);
    setShowCamera(true);
    setUploadState(prev => ({
      ...prev,
      status: 'idle',
      currentStep: 'method_selection',
      selectedFile: undefined
    }));
  }, []);

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
      
      {uploadState.status === 'idle' && !showCamera && !capturedImage && (
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

      {uploadState.status === 'idle' && !showCamera && capturedImage && (
        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Photo Preview</h3>
          <p className="text-gray-600 mb-4">
            Review your photo before proceeding to cropping
          </p>
          
          {/* Photo Preview */}
          <div className="mb-6">
            <div className="border rounded-lg overflow-hidden max-w-md mx-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capturedImage}
                alt="Captured photo preview"
                className="w-full h-auto"
              />
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="space-y-3">
            <button
              onClick={handleProceedWithImage}
              className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
            >
              ✓ Continue with this Photo
            </button>
            <button
              onClick={handleRetakePhoto}
              className="w-full bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
            >
              📷 Retake Photo
            </button>
          </div>
        </div>
      )}

      {uploadState.status === 'idle' && showCamera && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-800">Take a Photo</h3>
            <button
              onClick={() => setShowCamera(false)}
              className="text-gray-500 hover:text-gray-700 text-2xl"
              aria-label="Close camera"
            >
              ×
            </button>
          </div>
          
          <p className="text-gray-600 mb-4">
            Position your photo within the guides and tap capture
          </p>
          
          <CameraCapture
            onCapture={handleCameraCapture}
            onError={handleCameraError}
            facingMode="environment"
            aspectRatio={4/3}
          />
        </div>
      )}

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