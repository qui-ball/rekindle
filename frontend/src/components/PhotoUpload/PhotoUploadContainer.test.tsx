/**
 * PhotoUploadContainer Component Tests
 * 
 * Tests the main upload orchestration component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
          <button onClick={() => onCapture('mock-image-data')} data-testid="flow-capture">
            Capture Photo
          </button>
        </div>
      )}
    </div>
  )
}));

describe('PhotoUploadContainer', () => {
  const mockOnUploadComplete = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
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

  it('should handle photo capture from flow', () => {
    render(
      <PhotoUploadContainer
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    // Open flow and capture photo
    fireEvent.click(screen.getByText('📷 Take Photo'));
    fireEvent.click(screen.getByTestId('flow-capture'));

    // Should complete upload directly (no preview step)
    expect(mockOnUploadComplete).toHaveBeenCalled();
  });

  it('should complete upload directly after capture', () => {
    render(
      <PhotoUploadContainer
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    // Capture photo - should complete directly
    fireEvent.click(screen.getByText('📷 Take Photo'));
    fireEvent.click(screen.getByTestId('flow-capture'));

    // Should show completion state directly
    expect(screen.getByText('✅ Photo uploaded successfully!')).toBeInTheDocument();
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