/**
 * FileUploadModal Component Tests
 * 
 * Tests modal file upload functionality with desktop/mobile adaptive behavior
 * 
 * Test Coverage:
 * - Modal rendering and visibility
 * - Desktop: DragDropZone integration
 * - Mobile: Native file picker behavior
 * - File selection and validation
 * - Error handling
 * - Keyboard accessibility (Escape to close)
 * - Portal rendering
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FileUploadModal } from '../FileUploadModal';
import { ErrorType } from '../../../types/upload';

// Mock validateFile
const mockValidateFile = jest.fn();
jest.mock('../../../utils/fileUtils', () => ({
  validateFile: (file: File, maxSize: number, allowedTypes: string[]) => {
    return mockValidateFile(file, maxSize, allowedTypes);
  }
}));

// Mock createPortal to render in the same container for testing
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node
}));

// Helper to mock mobile/desktop detection
const mockUserAgent = (userAgent: string) => {
  Object.defineProperty(navigator, 'userAgent', {
    value: userAgent,
    configurable: true
  });
};

const mockWindowSize = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    configurable: true
  });
};

const mockTouchSupport = (hasTouch: boolean) => {
  Object.defineProperty(navigator, 'maxTouchPoints', {
    value: hasTouch ? 1 : 0,
    configurable: true
  });
};

describe('FileUploadModal', () => {
  const mockOnClose = jest.fn();
  const mockOnFileSelect = jest.fn();
  const mockOnError = jest.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onFileSelect: mockOnFileSelect,
    onError: mockOnError,
    accept: 'image/jpeg,image/png,image/heic,image/webp',
    maxSize: 50 * 1024 * 1024
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateFile.mockReturnValue({ valid: true });
    // Default to desktop
    mockUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    mockWindowSize(1024);
    mockTouchSupport(false);
  });

  describe('Modal Visibility', () => {
    it('renders modal when isOpen is true', () => {
      render(<FileUploadModal {...defaultProps} />);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Upload Photo')).toBeInTheDocument();
    });

    it('does not render modal when isOpen is false', () => {
      render(<FileUploadModal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes modal when backdrop is clicked', () => {
      render(<FileUploadModal {...defaultProps} />);
      
      const backdrop = screen.getByRole('dialog').querySelector('[aria-hidden="true"]');
      fireEvent.click(backdrop!);
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes modal when close button is clicked', () => {
      render(<FileUploadModal {...defaultProps} />);
      
      const closeButton = screen.getByLabelText('Close modal');
      fireEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes modal when Cancel button is clicked', () => {
      render(<FileUploadModal {...defaultProps} />);
      
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Keyboard Accessibility', () => {
    it('closes modal when Escape key is pressed', () => {
      render(<FileUploadModal {...defaultProps} />);
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('does not close on other keys', () => {
      render(<FileUploadModal {...defaultProps} />);
      
      fireEvent.keyDown(document, { key: 'Enter' });
      
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Desktop Behavior', () => {
    beforeEach(() => {
      mockUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      mockWindowSize(1024);
      mockTouchSupport(false);
    });

    it('shows DragDropZone on desktop', async () => {
      render(<FileUploadModal {...defaultProps} />);
      
      // Wait for useEffect to run
      await waitFor(() => {
        expect(screen.getByText(/drag & drop your photo here/i)).toBeInTheDocument();
      });
    });

    it('shows "Upload Photo" title on desktop', async () => {
      render(<FileUploadModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Upload Photo')).toBeInTheDocument();
      });
    });
  });

  describe('Mobile Behavior', () => {
    beforeEach(() => {
      mockUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)');
      mockWindowSize(375);
      mockTouchSupport(true);
    });

    it('shows simplified picker UI on mobile', async () => {
      render(<FileUploadModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Select Photo')).toBeInTheDocument();
        expect(screen.getByText(/select a photo from your device/i)).toBeInTheDocument();
        expect(screen.getByText('📁 Choose from Photos')).toBeInTheDocument();
      });
    });

    it('does not show DragDropZone on mobile', async () => {
      render(<FileUploadModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/drag & drop your photo here/i)).not.toBeInTheDocument();
      });
    });

    it('shows mobile upload button', async () => {
      render(<FileUploadModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('📁 Choose from Photos')).toBeInTheDocument();
      });
    });
  });

  describe('File Selection', () => {
    it('handles valid file selection', async () => {
      render(<FileUploadModal {...defaultProps} />);
      
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      const fileInput = screen.getByTestId('file-upload-modal-input');
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      expect(mockOnFileSelect).toHaveBeenCalledWith(file);
      // Parent (FileUploadFlow) controls closing - modal does not auto-close on valid selection
    });

    it('handles invalid file and shows error', async () => {
      mockValidateFile.mockReturnValue({
        valid: false,
        error: 'Unsupported file type'
      });
      
      render(<FileUploadModal {...defaultProps} />);
      
      const file = createMockFile('test.pdf', 'application/pdf', 1024);
      const fileInput = screen.getByTestId('file-upload-modal-input');
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      expect(mockOnFileSelect).not.toHaveBeenCalled();
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.VALIDATION_ERROR,
          message: 'Unsupported file type'
        })
      );
    });

    it('handles empty file selection gracefully', async () => {
      render(<FileUploadModal {...defaultProps} />);
      
      const fileInput = screen.getByTestId('file-upload-modal-input');
      
      fireEvent.change(fileInput, { target: { files: [] } });
      
      expect(mockOnFileSelect).not.toHaveBeenCalled();
      expect(mockOnError).not.toHaveBeenCalled();
    });

    it('handles null files gracefully', async () => {
      render(<FileUploadModal {...defaultProps} />);
      
      const fileInput = screen.getByTestId('file-upload-modal-input');
      
      fireEvent.change(fileInput, { target: { files: null } });
      
      expect(mockOnFileSelect).not.toHaveBeenCalled();
      expect(mockOnError).not.toHaveBeenCalled();
    });
  });

  describe('Props Handling', () => {
    it('uses custom accept types', () => {
      render(<FileUploadModal {...defaultProps} accept="image/jpeg,image/png" />);
      
      const fileInput = screen.getByTestId('file-upload-modal-input') as HTMLInputElement;
      expect(fileInput.accept).toBe('image/jpeg,image/png');
    });

    it('displays custom max size', async () => {
      const customMaxSize = 10 * 1024 * 1024; // 10MB
      render(<FileUploadModal {...defaultProps} maxSize={customMaxSize} />);
      
      // On desktop, DragDropZone shows the size
      await waitFor(() => {
        expect(screen.getByText(/maximum size: 10mb/i)).toBeInTheDocument();
      });
    });
  });

  describe('Aria Attributes', () => {
    it('has correct dialog role and aria-modal', () => {
      render(<FileUploadModal {...defaultProps} />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby pointing to title', () => {
      render(<FileUploadModal {...defaultProps} />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'file-upload-modal-title');
      expect(screen.getByText('Upload Photo')).toHaveAttribute('id', 'file-upload-modal-title');
    });
  });

  describe('Body Overflow', () => {
    it('sets body overflow to hidden when open', () => {
      render(<FileUploadModal {...defaultProps} />);
      
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('resets body overflow when closed', () => {
      const { rerender } = render(<FileUploadModal {...defaultProps} />);
      
      rerender(<FileUploadModal {...defaultProps} isOpen={false} />);
      
      expect(document.body.style.overflow).toBe('');
    });
  });
});

/**
 * Helper function to create mock File objects
 */
function createMockFile(name: string, type: string, size: number): File {
  const blob = new Blob(['x'.repeat(size)], { type });
  return new File([blob], name, { type });
}
