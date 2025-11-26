/**
 * PhotoUploadContainer Component Tests
 * 
 * Tests the main upload orchestration component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PhotoUploadContainer } from './PhotoUploadContainer';

// Mock the CameraCaptureFlow component
jest.mock('./CameraCaptureFlow', () => ({
  CameraCaptureFlow: ({ isOpen, onClose, onCapture }: { 
    isOpen: boolean; 
    onClose: () => void; 
    onCapture: (data: string) => void 
  }) => (
    <div data-testid="camera-capture-flow">
      {isOpen && (
        <div>
          <button onClick={onClose} data-testid="flow-close">Close Flow</button>
          <button onClick={() => onCapture('data:image/jpeg;base64,mock-image-data')} data-testid="flow-capture">
            Capture Photo
          </button>
        </div>
      )}
    </div>
  )
}));

// Mock file utilities
jest.mock('../../utils/fileUtils', () => ({
  base64ToFile: jest.fn((data: string, filename: string, mimeType: string) => {
    return new File([data], filename, { type: mimeType });
  }),
  validateFile: jest.fn(() => ({ valid: true, error: null })),
  getImageDimensionsFromBase64: jest.fn(() => Promise.resolve({ width: 1920, height: 1080 }))
}));

// Mock the usePhotoUpload hook
const mockUploadPhoto = jest.fn();
const mockResetUpload = jest.fn();

// Track upload state for testing
let uploadStateStatus: 'idle' | 'uploading' | 'complete' | 'error' = 'idle';

jest.mock('../../hooks/usePhotoUpload', () => ({
  usePhotoUpload: () => ({
    uploadPhoto: async (file: File, options?: any) => {
      uploadStateStatus = 'uploading';
      // Simulate upload progress
      if (options?.onProgress) {
        options.onProgress(50);
        await new Promise(resolve => setTimeout(resolve, 10));
        options.onProgress(100);
      }
      
      uploadStateStatus = 'complete';
      const result = {
        success: true,
        data: {
          uploadId: 'camera-123',
          fileKey: 'camera-capture-123.jpg',
          originalFileName: 'camera-capture-123.jpg',
          processingStatus: 'queued'
        }
      };
      
      return result;
    },
    uploadState: {
      get status() { return uploadStateStatus; },
      progress: uploadStateStatus === 'complete' ? 100 : 0,
      uploadResult: uploadStateStatus === 'complete' ? {
        uploadId: 'camera-123',
        fileKey: 'camera-capture-123.jpg',
        originalFileName: 'camera-capture-123.jpg',
        processingStatus: 'queued'
      } : null,
      error: null
    },
    resetUpload: mockResetUpload
  })
}));

describe('PhotoUploadContainer', () => {
  const mockOnUploadComplete = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    uploadStateStatus = 'idle';
  });

  it('should render upload method selection initially', () => {
    render(
      <PhotoUploadContainer
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    expect(screen.getByText('Upload Your Photo')).toBeInTheDocument();
    expect(screen.getByText('📷 Take Photo')).toBeInTheDocument();
    expect(screen.getByText('📁 Choose from Gallery (Coming Soon)')).toBeInTheDocument();
    expect(screen.getByText('💻 Upload from Computer (Coming Soon)')).toBeInTheDocument();
  });

  it('should open camera flow when Take Photo is clicked', () => {
    render(
      <PhotoUploadContainer
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    // Initially flow should not be visible
    expect(screen.queryByTestId('flow-close')).not.toBeInTheDocument();

    // Click Take Photo button
    fireEvent.click(screen.getByText('📷 Take Photo'));

    // Flow should now be visible
    expect(screen.getByTestId('flow-close')).toBeInTheDocument();
    expect(screen.getByTestId('flow-capture')).toBeInTheDocument();
  });

  it('should close camera flow when close is clicked', () => {
    render(
      <PhotoUploadContainer
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    // Open flow
    fireEvent.click(screen.getByText('📷 Take Photo'));
    expect(screen.getByTestId('flow-close')).toBeInTheDocument();

    // Close flow
    fireEvent.click(screen.getByTestId('flow-close'));
    expect(screen.queryByTestId('flow-close')).not.toBeInTheDocument();
  });

  it('should handle photo capture from flow', async () => {
    const { rerender } = render(
      <PhotoUploadContainer
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    // Open flow and capture photo
    fireEvent.click(screen.getByText('📷 Take Photo'));
    fireEvent.click(screen.getByTestId('flow-capture'));

    // Wait for async upload to complete
    await waitFor(() => {
      expect(mockOnUploadComplete).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('should complete upload directly after capture', async () => {
    render(
      <PhotoUploadContainer
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    // Capture photo - should trigger upload
    fireEvent.click(screen.getByText('📷 Take Photo'));
    fireEvent.click(screen.getByTestId('flow-capture'));

    // Wait for upload completion callback
    await waitFor(() => {
      expect(mockOnUploadComplete).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Verify callback was called with correct data
    expect(mockOnUploadComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadId: expect.stringContaining('camera-'),
        fileKey: expect.stringContaining('camera-capture-'),
        originalFileName: expect.stringContaining('camera-capture-'),
        processingStatus: 'queued'
      })
    );
  });


});