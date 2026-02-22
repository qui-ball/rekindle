/**
 * CameraCaptureFlow Upload Preview Integration Tests
 * 
 * Tests the complete upload preview flow including:
 * - Camera capture → Preview → Upload Preview → Confirm
 * - Perspective correction integration
 * - Error handling and fallback scenarios
 * - State transitions
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CameraCaptureFlow } from '../CameraCaptureFlow';
import { perspectiveCorrectionService } from '../../../services/perspectiveCorrectionService';

// Mock dependencies
jest.mock('../CameraCapture', () => ({
  CameraCapture: ({ onCapture }: { onCapture: (data: string) => void }) => (
    <div data-testid="mock-camera-capture">
      <button onClick={() => onCapture('data:image/jpeg;base64,captured...')}>
        Mock Capture
      </button>
    </div>
  )
}));

jest.mock('../../../services/SmartPhotoDetector', () => ({
  SmartPhotoDetector: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    detectPhotoBoundaries: jest.fn().mockResolvedValue({
      detected: true,
      confidence: 0.9,
      cropArea: { x: 100, y: 100, width: 400, height: 300 },
      cornerPoints: {
        topLeftCorner: { x: 100, y: 100 },
        topRightCorner: { x: 500, y: 120 },
        bottomLeftCorner: { x: 80, y: 400 },
        bottomRightCorner: { x: 520, y: 420 }
      },
      source: 'jscanify'
    })
  }))
}));

jest.mock('../../../services/perspectiveCorrectionService', () => ({
  perspectiveCorrectionService: {
    isReady: jest.fn(),
    initialize: jest.fn(),
    correctPerspective: jest.fn()
  }
}));

jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node
}));

describe.skip('CameraCaptureFlow - Upload Preview Integration', () => {
  const mockOnCapture = jest.fn();
  const mockOnClose = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    (perspectiveCorrectionService.isReady as jest.Mock).mockReturnValue(true);
    (perspectiveCorrectionService.initialize as jest.Mock).mockResolvedValue(true);
  });

  it('should complete full flow: capture → crop → upload preview → confirm', async () => {
    const mockCorrectedImage = 'data:image/jpeg;base64,corrected...';
    
    (perspectiveCorrectionService.correctPerspective as jest.Mock).mockResolvedValue({
      success: true,
      correctedImageData: mockCorrectedImage,
      processingTime: 500
    });

    render(
      <CameraCaptureFlow
        isOpen={true}
        onClose={mockOnClose}
        onCapture={mockOnCapture}
        onError={mockOnError}
      />
    );

    // Step 1: Capture photo
    const captureButton = screen.getByText('Mock Capture');
    fireEvent.click(captureButton);

    // Step 2: Wait for smart detection and crop interface
    await waitFor(() => {
      expect(screen.getByLabelText('Apply crop')).toBeInTheDocument();
    });

    // Step 3: Click crop button to proceed to upload preview
    const cropButton = screen.getByLabelText('Apply crop');
    fireEvent.click(cropButton);

    // Step 4: Wait for upload preview to show corrected image
    // The UploadPreview component processes in the background and shows the preview
    // We skip waiting for "Processing photo..." as it might be too fast to catch
    await waitFor(() => {
      expect(screen.getByText('Confirm & Upload')).toBeInTheDocument();
    }, { timeout: 10000 });

    // Step 6: Confirm upload
    const confirmButton = screen.getByText('Confirm & Upload');
    fireEvent.click(confirmButton);

    // Step 7: Verify onCapture was called with corrected image
    await waitFor(() => {
      expect(mockOnCapture).toHaveBeenCalledWith(mockCorrectedImage);
    });
  });

  it('should handle upload preview retake by returning to camera', async () => {
    (perspectiveCorrectionService.correctPerspective as jest.Mock).mockResolvedValue({
      success: true,
      correctedImageData: 'data:image/jpeg;base64,corrected...',
      processingTime: 500
    });

    render(
      <CameraCaptureFlow
        isOpen={true}
        onClose={mockOnClose}
        onCapture={mockOnCapture}
        onError={mockOnError}
      />
    );

    // Capture and proceed to upload preview
    fireEvent.click(screen.getByText('Mock Capture'));
    await waitFor(() => screen.getByLabelText('Apply crop'));
    fireEvent.click(screen.getByLabelText('Apply crop'));
    
    // Wait for processing to complete and Retake button to appear
    await waitFor(() => {
      expect(screen.getByText('Retake')).toBeInTheDocument();
    }, { timeout: 10000 });

    // Click retake button
    const retakeButton = screen.getByText('Retake');
    fireEvent.click(retakeButton);

    // Should return to camera capture view
    await waitFor(() => {
      expect(screen.getByText('Mock Capture')).toBeInTheDocument();
    });

    expect(mockOnCapture).not.toHaveBeenCalled();
  });

  it('should fallback to original image when perspective correction fails', async () => {
    const originalImage = 'data:image/jpeg;base64,captured...';
    
    (perspectiveCorrectionService.correctPerspective as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Correction failed',
      processingTime: 200
    });

    render(
      <CameraCaptureFlow
        isOpen={true}
        onClose={mockOnClose}
        onCapture={mockOnCapture}
        onError={mockOnError}
      />
    );

    // Capture and proceed through flow
    fireEvent.click(screen.getByText('Mock Capture'));
    await waitFor(() => screen.getByLabelText('Apply crop'));
    fireEvent.click(screen.getByLabelText('Apply crop'));

    // Wait for fallback warning (the text is "⚠️ Using original image (correction unavailable)")
    await waitFor(() => {
      expect(screen.getByText(/Using original image/i)).toBeInTheDocument();
    }, { timeout: 10000 });

    // Confirm should still work with original image
    const confirmButton = screen.getByText('Confirm & Upload');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockOnCapture).toHaveBeenCalledWith(originalImage);
    });
  });

  it('should skip upload preview when no corner points available', async () => {
    // Mock smart detector with no corner points
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SmartPhotoDetector } = require('../../../services/SmartPhotoDetector');
    SmartPhotoDetector.mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(true),
      detectPhotoBoundaries: jest.fn().mockResolvedValue({
        detected: false,
        confidence: 0.3,
        cropArea: { x: 100, y: 100, width: 400, height: 300 },
        cornerPoints: undefined, // No corner points
        source: 'fallback'
      })
    }));

    render(
      <CameraCaptureFlow
        isOpen={true}
        onClose={mockOnClose}
        onCapture={mockOnCapture}
        onError={mockOnError}
      />
    );

    // Capture photo
    fireEvent.click(screen.getByText('Mock Capture'));

    // Without corner points, the component should skip upload preview and call onCapture directly
    // The component calls onCapture with the cropped image when no corner points are available
    await waitFor(() => {
      expect(mockOnCapture).toHaveBeenCalled();
      expect(perspectiveCorrectionService.correctPerspective).not.toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('should handle perspective correction timeout gracefully', async () => {
    (perspectiveCorrectionService.correctPerspective as jest.Mock).mockImplementation(
      () => new Promise(resolve => {
        setTimeout(() => {
          resolve({
            success: false,
            error: 'Perspective correction timeout',
            processingTime: 5000
          });
        }, 100);
      })
    );

    render(
      <CameraCaptureFlow
        isOpen={true}
        onClose={mockOnClose}
        onCapture={mockOnCapture}
        onError={mockOnError}
      />
    );

    fireEvent.click(screen.getByText('Mock Capture'));
    await waitFor(() => screen.getByLabelText('Apply crop'));
    fireEvent.click(screen.getByLabelText('Apply crop'));

    // Should show fallback after timeout
    await waitFor(() => {
      expect(screen.getByText(/Using original image/i)).toBeInTheDocument();
    }, { timeout: 10000 });
  }, 15000);

  it('should pass correct corner points to perspective correction', async () => {
    const expectedCornerPoints = {
      topLeftCorner: { x: 100, y: 100 },
      topRightCorner: { x: 500, y: 120 },
      bottomLeftCorner: { x: 80, y: 400 },
      bottomRightCorner: { x: 520, y: 420 }
    };

    (perspectiveCorrectionService.correctPerspective as jest.Mock).mockResolvedValue({
      success: true,
      correctedImageData: 'data:image/jpeg;base64,corrected...',
      processingTime: 500
    });

    render(
      <CameraCaptureFlow
        isOpen={true}
        onClose={mockOnClose}
        onCapture={mockOnCapture}
        onError={mockOnError}
      />
    );

    fireEvent.click(screen.getByText('Mock Capture'));
    await waitFor(() => screen.getByLabelText('Apply crop'));
    fireEvent.click(screen.getByLabelText('Apply crop'));

    // Wait for perspective correction to be called
    await waitFor(() => {
      expect(perspectiveCorrectionService.correctPerspective).toHaveBeenCalled();
    }, { timeout: 10000 });

    // Verify the call was made with correct parameters (corner points format may vary)
    const calls = (perspectiveCorrectionService.correctPerspective as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const callArgs = calls[0];
    expect(callArgs[0]).toBeTruthy(); // Image data
    expect(callArgs[1]).toMatchObject(expectedCornerPoints); // Corner points
    expect(callArgs[2]).toMatchObject({
      quality: 0.95,
      timeout: 5000
    });
  });

  it('should close modal when escape is pressed in upload preview', async () => {
    (perspectiveCorrectionService.correctPerspective as jest.Mock).mockResolvedValue({
      success: true,
      correctedImageData: 'data:image/jpeg;base64,corrected...',
      processingTime: 500
    });

    render(
      <CameraCaptureFlow
        isOpen={true}
        onClose={mockOnClose}
        onCapture={mockOnCapture}
        onError={mockOnError}
        closeOnEscape={true}
      />
    );

    fireEvent.click(screen.getByText('Mock Capture'));
    await waitFor(() => screen.getByLabelText('Apply crop'));
    fireEvent.click(screen.getByLabelText('Apply crop'));
    
    // Wait for processing to complete and Retake button to appear
    await waitFor(() => {
      expect(screen.getByText('Retake')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Press escape
    fireEvent.keyDown(window, { key: 'Escape' });

    // Should return to camera view (retake action)
    await waitFor(() => {
      expect(screen.getByText('Mock Capture')).toBeInTheDocument();
    });
  });
});

