'use client';

import React, { useState, useCallback } from 'react';
import { PhotoUploadContainerProps, UploadError, ErrorType } from '../../types/upload';
import { CameraCaptureFlow } from './CameraCaptureFlow';
import { usePhotoUpload } from '../../hooks/usePhotoUpload';
import { base64ToFile, getImageDimensionsFromBase64, validateFile } from '../../utils/fileUtils';

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
  // Initialize upload hook
  const { uploadPhoto, uploadState, resetUpload } = usePhotoUpload();

  // Camera state
  const [showCamera, setShowCamera] = useState(false);

  // Handle camera capture - convert base64 to file and upload to S3
  const handleCameraCapture = useCallback(async (imageData: string) => {
    console.log('Photo captured from camera:', imageData.substring(0, 50) + '...');
    
    try {
      // Convert base64 to File object
      const file = base64ToFile(imageData, `camera-capture-${Date.now()}.jpg`, 'image/jpeg');
      
      // Validate file
      const validation = validateFile(file, maxFileSize, allowedFormats);
      if (!validation.valid) {
        const error: UploadError = {
          name: 'ValidationError',
          message: validation.error || 'File validation failed',
          code: 'VALIDATION_FAILED',
          type: ErrorType.VALIDATION_ERROR,
          retryable: false
        };
        onError(error);
        return;
      }

      // Get image dimensions (for future use in metadata)
      await getImageDimensionsFromBase64(imageData);
      
      // Upload to S3 using the upload hook
      const result = await uploadPhoto(file, {
        onProgress: (progress) => {
          console.log(`Upload progress: ${progress}%`);
        },
        onError: (error) => {
          console.error('Upload error:', error);
          onError(error);
        }
      });

      if (result.success) {
        console.log('✅ Upload successful:', result.data);
        setShowCamera(false);
        onUploadComplete(result.data);
      } else {
        console.error('❌ Upload failed:', result.error);
        onError(result.error);
      }
    } catch (error) {
      console.error('❌ Camera capture processing failed:', error);
      const uploadError: UploadError = {
        name: 'ProcessingError',
        message: error instanceof Error ? error.message : 'Failed to process captured image',
        code: 'PROCESSING_FAILED',
        type: ErrorType.PROCESSING_ERROR,
        retryable: true
      };
      onError(uploadError);
    }
  }, [uploadPhoto, onUploadComplete, onError, maxFileSize, allowedFormats]);



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
    onError(uploadError);
  }, [onError]);

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
              onClick={resetUpload}
            >
              Try Again
            </button>
          )}
        </div>
      )}
    </div>
  );
};