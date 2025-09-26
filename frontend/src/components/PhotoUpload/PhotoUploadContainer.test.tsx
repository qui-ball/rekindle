/**
 * PhotoUploadContainer Component Tests
 * 
 * Tests the main upload orchestration component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PhotoUploadContainer } from './PhotoUploadContainer';

// Mock the CameraCaptureModal component
jest.mock('./CameraCaptureModal', () => ({
  CameraCaptureModal: ({ isOpen, onClose, onCapture }: any) => (
    <div data-testid="camera-capture-modal">
      {isOpen && (
        <div>
          <button onClick={onClose} data-testid="modal-close">Close Modal</button>
          <button onClick={() => onCapture('mock-image-data')} data-testid="modal-capture">
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

  it('should open camera modal when Take Photo is clicked', () => {
    render(
      <PhotoUploadContainer
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    // Initially modal should not be visible
    expect(screen.queryByTestId('modal-close')).not.toBeInTheDocument();

    // Click Take Photo button
    fireEvent.click(screen.getByText('📷 Take Photo'));

    // Modal should now be visible
    expect(screen.getByTestId('modal-close')).toBeInTheDocument();
    expect(screen.getByTestId('modal-capture')).toBeInTheDocument();
  });

  it('should close camera modal when close is clicked', () => {
    render(
      <PhotoUploadContainer
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    // Open modal
    fireEvent.click(screen.getByText('📷 Take Photo'));
    expect(screen.getByTestId('modal-close')).toBeInTheDocument();

    // Close modal
    fireEvent.click(screen.getByTestId('modal-close'));
    expect(screen.queryByTestId('modal-close')).not.toBeInTheDocument();
  });

  it('should handle photo capture from modal', () => {
    render(
      <PhotoUploadContainer
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    // Open modal and capture photo
    fireEvent.click(screen.getByText('📷 Take Photo'));
    fireEvent.click(screen.getByTestId('modal-capture'));

    // Should show preview state
    expect(screen.getByText('Photo Preview')).toBeInTheDocument();
    expect(screen.getByText('✓ Continue with this Photo')).toBeInTheDocument();
    expect(screen.getByText('📷 Retake Photo')).toBeInTheDocument();
  });

  it('should complete upload when continuing with captured photo', () => {
    render(
      <PhotoUploadContainer
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    // Capture photo and continue
    fireEvent.click(screen.getByText('📷 Take Photo'));
    fireEvent.click(screen.getByTestId('modal-capture'));
    fireEvent.click(screen.getByText('✓ Continue with this Photo'));

    // Should show completion state
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

  it('should allow retaking photo', () => {
    render(
      <PhotoUploadContainer
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    // Capture photo and retake
    fireEvent.click(screen.getByText('📷 Take Photo'));
    fireEvent.click(screen.getByTestId('modal-capture'));
    fireEvent.click(screen.getByText('📷 Retake Photo'));

    // Should be back to modal state
    expect(screen.getByTestId('modal-close')).toBeInTheDocument();
    expect(screen.getByTestId('modal-capture')).toBeInTheDocument();
  });
});