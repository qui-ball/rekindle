/**
 * UploadPreview Component Tests
 * 
 * Tests the upload preview component including:
 * - Rendering and state management
 * - Perspective correction integration
 * - User interaction (confirm/cancel)
 * - Error handling and fallback behavior
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UploadPreview } from '../UploadPreview';
import { perspectiveCorrectionService } from '../../../services/perspectiveCorrectionService';
import type { CornerPoints } from '../../../types/jscanify';

// Mock perspectiveCorrectionService
jest.mock('../../../services/perspectiveCorrectionService', () => ({
  perspectiveCorrectionService: {
    isReady: jest.fn(),
    initialize: jest.fn(),
    correctPerspective: jest.fn()
  }
}));

// Mock createPortal to render directly
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node
}));

describe('UploadPreview', () => {
  const mockOriginalImage = 'data:image/jpeg;base64,original...';
  const mockCorrectedImage = 'data:image/jpeg;base64,corrected...';
  const mockCornerPoints: CornerPoints = {
    topLeftCorner: { x: 100, y: 100 },
    topRightCorner: { x: 500, y: 120 },
    bottomLeftCorner: { x: 80, y: 400 },
    bottomRightCorner: { x: 520, y: 420 }
  };

  const mockOnConfirm = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show processing state initially', () => {
    (perspectiveCorrectionService.isReady as jest.Mock).mockReturnValue(true);
    (perspectiveCorrectionService.correctPerspective as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(
      <UploadPreview
        originalImage={mockOriginalImage}
        cornerPoints={mockCornerPoints}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Processing photo...')).toBeInTheDocument();
    expect(screen.getByText('Applying perspective correction')).toBeInTheDocument();
  });

  it('should initialize service if not ready', async () => {
    (perspectiveCorrectionService.isReady as jest.Mock).mockReturnValue(false);
    (perspectiveCorrectionService.initialize as jest.Mock).mockResolvedValue(true);
    (perspectiveCorrectionService.correctPerspective as jest.Mock).mockResolvedValue({
      success: true,
      correctedImageData: mockCorrectedImage,
      processingTime: 500
    });

    render(
      <UploadPreview
        originalImage={mockOriginalImage}
        cornerPoints={mockCornerPoints}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(perspectiveCorrectionService.initialize).toHaveBeenCalled();
    });
  });

  it('should display corrected image on successful correction', async () => {
    (perspectiveCorrectionService.isReady as jest.Mock).mockReturnValue(true);
    (perspectiveCorrectionService.correctPerspective as jest.Mock).mockResolvedValue({
      success: true,
      correctedImageData: mockCorrectedImage,
      processingTime: 500
    });

    render(
      <UploadPreview
        originalImage={mockOriginalImage}
        cornerPoints={mockCornerPoints}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      const confirmButton = screen.getByText('Confirm & Upload');
      expect(confirmButton).toBeInTheDocument();
      expect(confirmButton).not.toBeDisabled();
    });
  });

  it('should fallback to original image on correction failure', async () => {
    (perspectiveCorrectionService.isReady as jest.Mock).mockReturnValue(true);
    (perspectiveCorrectionService.correctPerspective as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Correction failed',
      processingTime: 200
    });

    render(
      <UploadPreview
        originalImage={mockOriginalImage}
        cornerPoints={mockCornerPoints}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Using original image \(correction unavailable\)/i)).toBeInTheDocument();
    });
  });

  it('should call onConfirm with corrected image when confirm button is clicked', async () => {
    (perspectiveCorrectionService.isReady as jest.Mock).mockReturnValue(true);
    (perspectiveCorrectionService.correctPerspective as jest.Mock).mockResolvedValue({
      success: true,
      correctedImageData: mockCorrectedImage,
      processingTime: 500
    });

    render(
      <UploadPreview
        originalImage={mockOriginalImage}
        cornerPoints={mockCornerPoints}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      const confirmButton = screen.getByText('Confirm & Upload');
      expect(confirmButton).toBeInTheDocument();
    });

    const confirmButton = screen.getByText('Confirm & Upload');
    fireEvent.click(confirmButton);

    expect(mockOnConfirm).toHaveBeenCalledWith(mockCorrectedImage);
  });

  it('should call onConfirm with original image when fallback occurs', async () => {
    (perspectiveCorrectionService.isReady as jest.Mock).mockReturnValue(true);
    (perspectiveCorrectionService.correctPerspective as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Correction failed',
      processingTime: 200
    });

    render(
      <UploadPreview
        originalImage={mockOriginalImage}
        cornerPoints={mockCornerPoints}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      const confirmButton = screen.getByText('Confirm & Upload');
      expect(confirmButton).toBeInTheDocument();
    });

    const confirmButton = screen.getByText('Confirm & Upload');
    fireEvent.click(confirmButton);

    expect(mockOnConfirm).toHaveBeenCalledWith(mockOriginalImage);
  });

  it('should call onCancel when retake button is clicked', async () => {
    (perspectiveCorrectionService.isReady as jest.Mock).mockReturnValue(true);
    (perspectiveCorrectionService.correctPerspective as jest.Mock).mockResolvedValue({
      success: true,
      correctedImageData: mockCorrectedImage,
      processingTime: 500
    });

    render(
      <UploadPreview
        originalImage={mockOriginalImage}
        cornerPoints={mockCornerPoints}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Retake')).toBeInTheDocument();
    });

    const retakeButton = screen.getByText('Retake');
    fireEvent.click(retakeButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should call onCancel when escape key is pressed', async () => {
    (perspectiveCorrectionService.isReady as jest.Mock).mockReturnValue(true);
    (perspectiveCorrectionService.correctPerspective as jest.Mock).mockResolvedValue({
      success: true,
      correctedImageData: mockCorrectedImage,
      processingTime: 500
    });

    render(
      <UploadPreview
        originalImage={mockOriginalImage}
        cornerPoints={mockCornerPoints}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        closeOnEscape={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Retake')).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should not call onCancel on escape when closeOnEscape is false', async () => {
    (perspectiveCorrectionService.isReady as jest.Mock).mockReturnValue(true);
    (perspectiveCorrectionService.correctPerspective as jest.Mock).mockResolvedValue({
      success: true,
      correctedImageData: mockCorrectedImage,
      processingTime: 500
    });

    render(
      <UploadPreview
        originalImage={mockOriginalImage}
        cornerPoints={mockCornerPoints}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        closeOnEscape={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Retake')).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  it('should handle errors during correction gracefully', async () => {
    (perspectiveCorrectionService.isReady as jest.Mock).mockReturnValue(true);
    (perspectiveCorrectionService.correctPerspective as jest.Mock).mockRejectedValue(
      new Error('OpenCV error')
    );

    render(
      <UploadPreview
        originalImage={mockOriginalImage}
        cornerPoints={mockCornerPoints}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Using original image \(correction unavailable\)/i)).toBeInTheDocument();
    });
  });

  it('should pass correct options to correctPerspective', async () => {
    (perspectiveCorrectionService.isReady as jest.Mock).mockReturnValue(true);
    (perspectiveCorrectionService.correctPerspective as jest.Mock).mockResolvedValue({
      success: true,
      correctedImageData: mockCorrectedImage,
      processingTime: 500
    });

    render(
      <UploadPreview
        originalImage={mockOriginalImage}
        cornerPoints={mockCornerPoints}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(perspectiveCorrectionService.correctPerspective).toHaveBeenCalledWith(
        mockOriginalImage,
        mockCornerPoints,
        {
          quality: 0.95,
          timeout: 5000
        }
      );
    });
  });
});

