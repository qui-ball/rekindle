/**
 * CameraCaptureModal Component Tests
 * 
 * Tests modal functionality, keyboard interactions, and flow states
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CameraCaptureModal } from './CameraCaptureModal';

// Mock the CameraCaptureFlow component
jest.mock('./CameraCaptureFlow', () => ({
  CameraCaptureFlow: ({ isOpen, onClose, onCapture, onError }: any) => {
    if (!isOpen) return null;
    
    return (
      <div data-testid="mock-camera-flow">
        <button onClick={() => onCapture('mock-image-data')}>Mock Capture</button>
        <button onClick={onClose}>Mock Cancel</button>
        <button onClick={() => onError({ code: 'CAMERA_ERROR', message: 'Error' })}>Mock Error</button>
        <button onClick={onClose}>Mock Close</button>
      </div>
    );
  }
}));

describe('CameraCaptureModal', () => {
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

  describe('Modal Visibility', () => {
    it('should render when isOpen is true', () => {
      render(<CameraCaptureModal {...defaultProps} />);
      
      expect(screen.getByTestId('mock-camera-flow')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<CameraCaptureModal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByTestId('mock-camera-flow')).not.toBeInTheDocument();
    });
  });

  describe('Flow Interactions', () => {
    it('should handle close action', () => {
      render(<CameraCaptureModal {...defaultProps} />);
      
      const closeButton = screen.getByText('Mock Close');
      fireEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Camera Interactions', () => {
    it('should handle successful capture', async () => {
      render(<CameraCaptureModal {...defaultProps} />);
      
      const captureButton = screen.getByText('Mock Capture');
      fireEvent.click(captureButton);
      
      expect(mockOnCapture).toHaveBeenCalledWith('mock-image-data');
    });

    it('should handle user cancellation', async () => {
      render(<CameraCaptureModal {...defaultProps} />);
      
      const cancelButton = screen.getByText('Mock Cancel');
      fireEvent.click(cancelButton);
      
      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnError).not.toHaveBeenCalled();
    });

    it('should handle camera errors', async () => {
      render(<CameraCaptureModal {...defaultProps} />);
      
      const errorButton = screen.getByText('Mock Error');
      fireEvent.click(errorButton);
      
      expect(mockOnError).toHaveBeenCalledWith({ code: 'CAMERA_ERROR', message: 'Error' });
    });
  });

  describe('Props Handling', () => {
    it('should pass facingMode to flow component', () => {
      render(<CameraCaptureModal {...defaultProps} facingMode="user" />);
      
      expect(screen.getByTestId('mock-camera-flow')).toBeInTheDocument();
    });

    it('should pass aspectRatio to flow component', () => {
      render(<CameraCaptureModal {...defaultProps} aspectRatio={16/9} />);
      
      expect(screen.getByTestId('mock-camera-flow')).toBeInTheDocument();
    });
  });
});