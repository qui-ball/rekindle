/**
 * CameraCaptureFlow Component Tests
 * 
 * Tests the complete camera capture flow including capture and cropping states
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CameraCaptureFlow } from './CameraCaptureFlow';

// Mock the CameraCapture component
jest.mock('./CameraCapture', () => ({
  CameraCapture: ({ onCapture, onError }: { onCapture: (data: string) => void; onError: (error: { code: string; message: string }) => void }) => (
    <div data-testid="mock-camera-capture">
      <button onClick={() => onCapture('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA==')}>Mock Capture</button>
      <button onClick={() => onError({ code: 'USER_CANCELLED', message: 'Cancelled' })}>Mock Cancel</button>
      <button onClick={() => onError({ code: 'CAMERA_ERROR', message: 'Error' })}>Mock Error</button>
    </div>
  )
}));

// Mock createPortal
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node
}));

// Mock Image constructor for tests
const mockImage = {
  onload: null as (() => void) | null,
  onerror: null as (() => void) | null,
  naturalWidth: 800,
  naturalHeight: 600,
  set src(value: string) {
    // Simulate successful image load
    setTimeout(() => {
      if (this.onload) {
        this.onload();
      }
    }, 0);
  }
};

global.Image = jest.fn(() => mockImage) as unknown as typeof Image;

describe('CameraCaptureFlow', () => {
  const mockOnCapture = jest.fn();
  const mockOnError = jest.fn();
  const mockOnClose = jest.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onCapture: mockOnCapture,
    onError: mockOnError,
    facingMode: 'environment' as const,
    aspectRatio: 4 / 3
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Reset body overflow style
    document.body.style.overflow = 'unset';
  });

  describe('Flow States', () => {
    it('should start in capturing state', () => {
      render(<CameraCaptureFlow {...defaultProps} />);
      
      expect(screen.getByTestId('mock-camera-capture')).toBeInTheDocument();
      expect(screen.getByText('Take Photo')).toBeInTheDocument(); // From header
    });

    it('should not render when isOpen is false', () => {
      render(<CameraCaptureFlow {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByTestId('mock-camera-capture')).not.toBeInTheDocument();
    });

    it('should prevent body scroll when open', () => {
      render(<CameraCaptureFlow {...defaultProps} />);
      
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should restore body scroll when closed', () => {
      const { rerender } = render(<CameraCaptureFlow {...defaultProps} />);
      
      expect(document.body.style.overflow).toBe('hidden');
      
      rerender(<CameraCaptureFlow {...defaultProps} isOpen={false} />);
      
      expect(document.body.style.overflow).toBe('unset');
    });
  });

  describe('Capture Flow', () => {
    it('should move to cropping state after capture', async () => {
      render(<CameraCaptureFlow {...defaultProps} />);
      
      // Should start in capture state
      expect(screen.getByTestId('mock-camera-capture')).toBeInTheDocument();
      
      // Capture photo
      const captureButton = screen.getByText('Mock Capture');
      fireEvent.click(captureButton);
      
      // Should move directly to cropping state
      await waitFor(() => {
        // The QuadrilateralCropper component should be rendered
        expect(screen.getByText('✓ Crop')).toBeInTheDocument();
      });
    });

    it('should show captured image in cropping interface', async () => {
      render(<CameraCaptureFlow {...defaultProps} />);
      
      // Capture photo
      const captureButton = screen.getByText('Mock Capture');
      fireEvent.click(captureButton);
      
      // Should show cropping image
      await waitFor(() => {
        const cropImage = screen.getByAltText('Crop preview');
        expect(cropImage).toBeInTheDocument();
        expect(cropImage).toHaveAttribute('src', expect.stringContaining('data:image/jpeg;base64'));
      });
    });
  });

  describe('Cropping Actions', () => {
    beforeEach(async () => {
      render(<CameraCaptureFlow {...defaultProps} />);
      
      // Move to cropping state
      const captureButton = screen.getByText('Mock Capture');
      fireEvent.click(captureButton);
      
      await waitFor(() => {
        expect(screen.getByText('✓ Crop')).toBeInTheDocument();
      });
    });

    it('should show cropping interface after capture', async () => {
      // The cropping interface should be visible after capture
      await waitFor(() => {
        expect(screen.getByText('✓ Crop')).toBeInTheDocument();
      });
      
      // Should not call onCapture yet (only after crop is accepted)
      expect(mockOnCapture).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should cancel crop and return to capture', async () => {
      // Wait for cropping interface to appear
      await waitFor(() => {
        expect(screen.getByText('✓ Crop')).toBeInTheDocument();
      });
      
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      
      // Should return to capture state
      await waitFor(() => {
        expect(screen.getByTestId('mock-camera-capture')).toBeInTheDocument();
        expect(screen.getByText('Take Photo')).toBeInTheDocument(); // From header
      });
      
      expect(mockOnCapture).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle user cancellation and close flow', () => {
      render(<CameraCaptureFlow {...defaultProps} />);
      
      const cancelButton = screen.getByText('Mock Cancel');
      fireEvent.click(cancelButton);
      
      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnError).not.toHaveBeenCalled();
    });

    it('should handle camera errors without closing flow', () => {
      render(<CameraCaptureFlow {...defaultProps} />);
      
      const errorButton = screen.getByText('Mock Error');
      fireEvent.click(errorButton);
      
      expect(mockOnError).toHaveBeenCalledWith({ code: 'CAMERA_ERROR', message: 'Error' });
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Interactions', () => {
    it('should close on Escape key by default', () => {
      render(<CameraCaptureFlow {...defaultProps} />);
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not close on Escape key when closeOnEscape is false', () => {
      render(<CameraCaptureFlow {...defaultProps} closeOnEscape={false} />);
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should not close on other keys', () => {
      render(<CameraCaptureFlow {...defaultProps} />);
      
      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.keyDown(document, { key: 'Space' });
      
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Responsive Layout', () => {
    beforeEach(() => {
      // Mock window dimensions
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 768,
      });
    });

    it('should detect landscape mode on mobile devices', () => {
      // Set mobile landscape dimensions
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 667, // Mobile width in landscape
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 375, // Mobile height in landscape
      });

      render(<CameraCaptureFlow {...defaultProps} />);

      // Trigger orientation change
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      // Should render with landscape layout
      expect(screen.getByText('Take Photo')).toBeInTheDocument();
    });

    it('should handle orientation changes during cropping', async () => {
      render(<CameraCaptureFlow {...defaultProps} />);

      // Move to cropping state by triggering the mock capture
      act(() => {
        // Simulate camera capture by calling the onCapture callback directly
        const captureButton = screen.getByText('Mock Capture');
        fireEvent.click(captureButton);
      });

      await waitFor(() => {
        expect(screen.getByText('✓ Crop')).toBeInTheDocument();
      });

      // Change to landscape
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 667,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 375,
      });

      act(() => {
        window.dispatchEvent(new Event('orientationchange'));
      });

      // Should still show cropping interface
      expect(screen.getByText('✓ Crop')).toBeInTheDocument();
    });
  });
});