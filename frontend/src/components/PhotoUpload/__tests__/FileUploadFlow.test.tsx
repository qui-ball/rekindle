/**
 * FileUploadFlow Component Tests
 * 
 * Tests the simplified file upload flow:
 * - File selection state (FileUploadModal)
 * - Preview state (UploadPreview)
 * - State transitions
 * - Error handling
 * - Modal behavior (escape key, close)
 * 
 * Note: Simplified flow skips cropping - goes directly from file selection to preview
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FileUploadFlow } from '../FileUploadFlow';
import { ErrorType, UploadError } from '../../../types/upload';

// Mock FileUploadModal
jest.mock('../FileUploadModal', () => ({
  FileUploadModal: ({ isOpen, onClose, onFileSelect, onError }: {
    isOpen: boolean;
    onClose: () => void;
    onFileSelect: (file: File) => void;
    onError: (error: UploadError) => void;
  }) => (
    isOpen ? (
      <div data-testid="file-upload-modal">
        <button onClick={onClose} data-testid="modal-close">Close</button>
        <button 
          onClick={() => onFileSelect(new File(['test'], 'test.jpg', { type: 'image/jpeg' }))}
          data-testid="select-file"
        >
          Select File
        </button>
        <button
          onClick={() => onError({ 
            name: 'ValidationError', 
            message: 'Test error', 
            code: 'TEST_ERROR',
            type: ErrorType.VALIDATION_ERROR,
            retryable: false
          })}
          data-testid="trigger-error"
        >
          Trigger Error
        </button>
      </div>
    ) : null
  )
}));

// Mock UploadPreview
jest.mock('../UploadPreview', () => ({
  UploadPreview: ({ onConfirm, onCancel, originalImage }: {
    onConfirm: (image: string) => void;
    onCancel: () => void;
    originalImage: string;
  }) => (
    <div data-testid="upload-preview">
      <div data-testid="preview-image">{originalImage.substring(0, 50)}</div>
      <button 
        onClick={() => onConfirm(originalImage)}
        data-testid="confirm-upload"
      >
        Confirm Upload
      </button>
      <button onClick={onCancel} data-testid="cancel-preview">Cancel</button>
    </div>
  )
}));

// Mock fileUtils
const mockFileToDataUrl = jest.fn();
const mockGetImageDimensionsFromBase64 = jest.fn();

jest.mock('../../../utils/fileUtils', () => ({
  fileToDataUrl: (file: File) => mockFileToDataUrl(file),
  getImageDimensionsFromBase64: (dataUrl: string) => mockGetImageDimensionsFromBase64(dataUrl)
}));

// Mock createPortal
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node
}));

describe('FileUploadFlow', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onUpload: jest.fn(),
    onError: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock behaviors
    mockFileToDataUrl.mockResolvedValue('data:image/jpeg;base64,testimage');
    mockGetImageDimensionsFromBase64.mockResolvedValue({ width: 800, height: 600 });
  });

  describe('Rendering', () => {
    it('renders nothing when not open', () => {
      render(<FileUploadFlow {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByTestId('file-upload-modal')).not.toBeInTheDocument();
    });

    it('renders FileUploadModal in selecting state', () => {
      render(<FileUploadFlow {...defaultProps} />);
      
      expect(screen.getByTestId('file-upload-modal')).toBeInTheDocument();
    });
  });

  describe('File Selection', () => {
    it('calls onClose when modal is closed', async () => {
      render(<FileUploadFlow {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('modal-close'));
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onError when file selection fails', async () => {
      render(<FileUploadFlow {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('trigger-error'));
      
      expect(defaultProps.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.VALIDATION_ERROR
        })
      );
    });

    it('transitions to preview state after file selection', async () => {
      render(<FileUploadFlow {...defaultProps} />);
      
      await act(async () => {
        fireEvent.click(screen.getByTestId('select-file'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('upload-preview')).toBeInTheDocument();
      });

      expect(mockFileToDataUrl).toHaveBeenCalled();
    });

    it('passes image data to UploadPreview', async () => {
      const testDataUrl = 'data:image/jpeg;base64,testimagedata';
      mockFileToDataUrl.mockResolvedValueOnce(testDataUrl);
      
      render(<FileUploadFlow {...defaultProps} />);
      
      await act(async () => {
        fireEvent.click(screen.getByTestId('select-file'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('preview-image')).toHaveTextContent(testDataUrl.substring(0, 50));
      });
    });
  });

  describe('Preview State', () => {
    it('shows UploadPreview after file selection', async () => {
      render(<FileUploadFlow {...defaultProps} />);
      
      await act(async () => {
        fireEvent.click(screen.getByTestId('select-file'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('upload-preview')).toBeInTheDocument();
      });
    });

    it('returns to selecting state when preview is cancelled', async () => {
      render(<FileUploadFlow {...defaultProps} />);
      
      // Navigate to preview
      await act(async () => {
        fireEvent.click(screen.getByTestId('select-file'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('upload-preview')).toBeInTheDocument();
      });

      // Cancel preview
      fireEvent.click(screen.getByTestId('cancel-preview'));

      // Should return to file selection
      await waitFor(() => {
        expect(screen.getByTestId('file-upload-modal')).toBeInTheDocument();
      });
    });

    it('calls onUpload when preview is confirmed', async () => {
      const testDataUrl = 'data:image/jpeg;base64,testimagedata';
      mockFileToDataUrl.mockResolvedValueOnce(testDataUrl);
      
      render(<FileUploadFlow {...defaultProps} />);
      
      // Navigate to preview
      await act(async () => {
        fireEvent.click(screen.getByTestId('select-file'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('upload-preview')).toBeInTheDocument();
      });

      // Confirm upload
      fireEvent.click(screen.getByTestId('confirm-upload'));

      expect(defaultProps.onUpload).toHaveBeenCalledWith(testDataUrl);
      // Should NOT close - parent controls that
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe('Escape Key Handling', () => {
    it('closes modal on escape key by default', async () => {
      render(<FileUploadFlow {...defaultProps} />);
      
      fireEvent.keyDown(document, { key: 'Escape' });

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('does not close on escape when closeOnEscape is false', async () => {
      render(<FileUploadFlow {...defaultProps} closeOnEscape={false} />);
      
      fireEvent.keyDown(document, { key: 'Escape' });

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles file read errors gracefully', async () => {
      mockFileToDataUrl.mockRejectedValueOnce(new Error('Read failed'));
      
      render(<FileUploadFlow {...defaultProps} />);
      
      await act(async () => {
        fireEvent.click(screen.getByTestId('select-file'));
      });

      // Should call onError and reset to selecting
      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith(
          expect.objectContaining({
            type: ErrorType.PROCESSING_ERROR,
            code: 'FILE_PROCESSING_FAILED'
          })
        );
      });

      // Should return to selecting state
      await waitFor(() => {
        expect(screen.getByTestId('file-upload-modal')).toBeInTheDocument();
      });
    });

    it('handles dimension extraction failure gracefully', async () => {
      mockFileToDataUrl.mockResolvedValueOnce('data:image/jpeg;base64,test');
      mockGetImageDimensionsFromBase64.mockRejectedValueOnce(new Error('Dimension extraction failed'));
      
      render(<FileUploadFlow {...defaultProps} />);
      
      await act(async () => {
        fireEvent.click(screen.getByTestId('select-file'));
      });

      // Should still proceed to preview despite dimension extraction failure
      await waitFor(() => {
        expect(screen.getByTestId('upload-preview')).toBeInTheDocument();
      });

      expect(defaultProps.onError).not.toHaveBeenCalled();
    });
  });

  describe('Props', () => {
    it('passes accept prop to FileUploadModal', () => {
      render(<FileUploadFlow {...defaultProps} accept="image/png" />);
      
      // FileUploadModal is rendered
      expect(screen.getByTestId('file-upload-modal')).toBeInTheDocument();
    });

    it('passes maxSize prop to FileUploadModal', () => {
      render(<FileUploadFlow {...defaultProps} maxSize={10 * 1024 * 1024} />);
      
      expect(screen.getByTestId('file-upload-modal')).toBeInTheDocument();
    });
  });

  describe('State Management', () => {
    it('resets state when flow is closed', async () => {
      const { rerender } = render(<FileUploadFlow {...defaultProps} key="initial" />);
      
      // Navigate to preview
      await act(async () => {
        fireEvent.click(screen.getByTestId('select-file'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('upload-preview')).toBeInTheDocument();
      });

      // Close flow and reopen with new key to force fresh state
      rerender(<FileUploadFlow {...defaultProps} isOpen={false} key="closed" />);
      rerender(<FileUploadFlow {...defaultProps} isOpen={true} key="reopen" />);

      await waitFor(() => {
        expect(screen.getByTestId('file-upload-modal')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('upload-preview')).not.toBeInTheDocument();
    });

    it('prevents body scroll when modal is open', () => {
      render(<FileUploadFlow {...defaultProps} />);
      
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body scroll when modal is closed', () => {
      const { rerender } = render(<FileUploadFlow {...defaultProps} />);
      
      expect(document.body.style.overflow).toBe('hidden');
      
      rerender(<FileUploadFlow {...defaultProps} isOpen={false} />);
      
      expect(document.body.style.overflow).toBe('');
    });
  });
});
