/**
 * DragDropZone Component Tests
 * 
 * Tests drag-and-drop file upload functionality
 * 
 * Test Coverage:
 * - Drag and drop event handlers
 * - Visual feedback for drag-over states
 * - File browser fallback functionality
 * - File validation and error handling
 * - HEIC file handling (extension fallback)
 * - Disabled state handling
 * - Keyboard accessibility
 * - Processing/loading state
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DragDropZone } from '../DragDropZone';
import { ErrorType } from '../../../types/upload';

// Test file size constants
const FILE_SIZES = {
  SMALL: 1024,
  VALID: 5 * 1024 * 1024,
  TOO_LARGE: 100 * 1024 * 1024
} as const;

// Mock file utilities
const mockValidateFile = jest.fn();
jest.mock('../../../utils/fileUtils', () => ({
  validateFile: (file: File, maxSize: number, allowedTypes: string[]) => {
    return mockValidateFile(file, maxSize, allowedTypes);
  }
}));

describe('DragDropZone', () => {
  const mockOnFileSelect = jest.fn();
  const mockOnError = jest.fn();

  const defaultProps = {
    onFileSelect: mockOnFileSelect,
    onError: mockOnError,
    accept: 'image/jpeg,image/png,image/heic,image/webp',
    maxSize: 50 * 1024 * 1024 // 50MB
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateFile.mockReturnValue({ valid: true });
  });

  describe('Rendering', () => {
    it('renders the drop zone with default content', () => {
      render(<DragDropZone {...defaultProps} />);
      
      expect(screen.getByText(/drag & drop your photo here/i)).toBeInTheDocument();
      expect(screen.getByText(/browse files/i)).toBeInTheDocument();
      expect(screen.getByText(/supported formats: jpeg, png, heic, webp/i)).toBeInTheDocument();
      expect(screen.getByText(/maximum size: 50mb/i)).toBeInTheDocument();
    });

    it('renders hidden file input', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const fileInput = screen.getByLabelText('File input') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();
      expect(fileInput.type).toBe('file');
      expect(fileInput.accept).toBe(defaultProps.accept);
      expect(fileInput).toHaveClass('hidden');
    });

    it('renders disabled state correctly', () => {
      render(<DragDropZone {...defaultProps} disabled={true} />);
      
      const dropZone = screen.getByRole('button');
      expect(dropZone).toHaveAttribute('aria-disabled', 'true');
      expect(dropZone).toHaveClass('cursor-not-allowed', 'opacity-50');
      expect(screen.getByText(/upload disabled/i)).toBeInTheDocument();
    });

    it('has correct data-testid attribute', () => {
      render(<DragDropZone {...defaultProps} />);
      
      expect(screen.getByTestId('drag-drop-zone')).toBeInTheDocument();
    });

    it('has idle drag state by default', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByTestId('drag-drop-zone');
      expect(dropZone).toHaveAttribute('data-drag-state', 'idle');
    });
  });

  describe('Drag and Drop Events', () => {
    it('handles drag enter event and updates state', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByTestId('drag-drop-zone');
      const dragEvent = createDragEvent('dragenter', { types: ['Files'] });
      
      fireEvent(dropZone, dragEvent);
      
      expect(dropZone).toHaveAttribute('data-drag-state', 'dragging');
    });

    it('handles drag over event and shows active state', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByTestId('drag-drop-zone');
      const dragEvent = createDragEvent('dragover', { types: ['Files'] });
      
      fireEvent(dropZone, dragEvent);
      
      expect(dropZone).toHaveAttribute('data-drag-state', 'dragover');
      expect(dropZone).toHaveClass('border-cozy-accent', 'bg-cozy-mount', 'motion-safe:scale-105', 'shadow-cozy-card');
    });

    it('handles drag leave event with counter-based tracking', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByTestId('drag-drop-zone');
      
      // Enter twice (simulating entering parent, then child)
      fireEvent(dropZone, createDragEvent('dragenter', { types: ['Files'] }));
      fireEvent(dropZone, createDragEvent('dragenter', { types: ['Files'] }));
      
      // Leave once - should still be dragging
      fireEvent(dropZone, createDragEvent('dragleave', { types: ['Files'] }));
      expect(dropZone).toHaveAttribute('data-drag-state', 'dragging');
      
      // Leave again - should reset to idle
      fireEvent(dropZone, createDragEvent('dragleave', { types: ['Files'] }));
      expect(dropZone).toHaveAttribute('data-drag-state', 'idle');
    });

    it('handles drop event with valid file', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByTestId('drag-drop-zone');
      const file = createMockFile('test.jpg', 'image/jpeg', FILE_SIZES.VALID);
      
      const dropEvent = createDragEvent('drop', {
        types: ['Files'],
        files: [file]
      });
      
      fireEvent(dropZone, dropEvent);
      
      expect(mockOnFileSelect).toHaveBeenCalledWith(file);
      expect(mockOnError).not.toHaveBeenCalled();
      expect(dropZone).toHaveAttribute('data-drag-state', 'idle');
    });

    it('handles drop event with invalid file type', () => {
      mockValidateFile.mockReturnValue({
        valid: false,
        error: 'Unsupported file type. Allowed: image/jpeg, image/png, image/heic, image/webp'
      });
      
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByTestId('drag-drop-zone');
      const file = createMockFile('test.txt', 'text/plain', FILE_SIZES.SMALL);
      
      const dropEvent = createDragEvent('drop', {
        types: ['Files'],
        files: [file]
      });
      
      fireEvent(dropZone, dropEvent);
      
      expect(mockOnFileSelect).not.toHaveBeenCalled();
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.VALIDATION_ERROR,
          code: 'VALIDATION_FAILED'
        })
      );
    });

    it('handles drop event with file too large', () => {
      mockValidateFile.mockReturnValue({
        valid: false,
        error: 'File too large. Maximum size: 50MB'
      });
      
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByTestId('drag-drop-zone');
      const file = createMockFile('large.jpg', 'image/jpeg', FILE_SIZES.TOO_LARGE);
      
      const dropEvent = createDragEvent('drop', {
        types: ['Files'],
        files: [file]
      });
      
      fireEvent(dropZone, dropEvent);
      
      expect(mockOnFileSelect).not.toHaveBeenCalled();
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.VALIDATION_ERROR
        })
      );
    });

    it('only processes first file when multiple files are dropped', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByTestId('drag-drop-zone');
      const file1 = createMockFile('test1.jpg', 'image/jpeg', FILE_SIZES.SMALL);
      const file2 = createMockFile('test2.jpg', 'image/jpeg', FILE_SIZES.VALID);
      
      const dropEvent = createDragEvent('drop', {
        types: ['Files'],
        files: [file1, file2]
      });
      
      fireEvent(dropZone, dropEvent);
      
      expect(mockOnFileSelect).toHaveBeenCalledTimes(1);
      expect(mockOnFileSelect).toHaveBeenCalledWith(file1);
    });

    it('resets drag counter on drop', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByTestId('drag-drop-zone');
      const file = createMockFile('test.jpg', 'image/jpeg', FILE_SIZES.SMALL);
      
      // Enter drag multiple times
      fireEvent(dropZone, createDragEvent('dragenter', { types: ['Files'] }));
      fireEvent(dropZone, createDragEvent('dragenter', { types: ['Files'] }));
      
      // Drop should reset counter
      fireEvent(dropZone, createDragEvent('drop', { types: ['Files'], files: [file] }));
      
      // State should be idle
      expect(dropZone).toHaveAttribute('data-drag-state', 'idle');
    });

    it('ignores drag events when disabled', () => {
      render(<DragDropZone {...defaultProps} disabled={true} />);
      
      const dropZone = screen.getByTestId('drag-drop-zone');
      const dragEvent = createDragEvent('dragenter', { types: ['Files'] });
      
      fireEvent(dropZone, dragEvent);
      
      // Should remain idle
      expect(dropZone).toHaveAttribute('data-drag-state', 'idle');
    });
  });

  describe('File Browser Fallback', () => {
    it('opens file browser when drop zone is clicked', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByRole('button');
      const fileInput = screen.getByLabelText('File input') as HTMLInputElement;
      const clickSpy = jest.spyOn(fileInput, 'click');
      
      fireEvent.click(dropZone);
      
      expect(clickSpy).toHaveBeenCalled();
    });

    it('handles file selection from browser', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const fileInput = screen.getByLabelText('File input') as HTMLInputElement;
      const file = createMockFile('test.jpg', 'image/jpeg', FILE_SIZES.SMALL);
      
      fireEvent.change(fileInput, {
        target: { files: [file] }
      });
      
      expect(mockOnFileSelect).toHaveBeenCalledWith(file);
    });

    it('resets file input after selection', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const fileInput = screen.getByLabelText('File input') as HTMLInputElement;
      const file = createMockFile('test.jpg', 'image/jpeg', FILE_SIZES.SMALL);
      
      fireEvent.change(fileInput, {
        target: { files: [file] }
      });
      
      // Input should be reset
      expect(fileInput.value).toBe('');
    });

    it('does not open file browser when disabled', () => {
      render(<DragDropZone {...defaultProps} disabled={true} />);
      
      const dropZone = screen.getByRole('button');
      const fileInput = screen.getByLabelText('File input') as HTMLInputElement;
      const clickSpy = jest.spyOn(fileInput, 'click');
      
      fireEvent.click(dropZone);
      
      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  describe('Visual Feedback', () => {
    it('shows drag-over state with correct styling and text', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByTestId('drag-drop-zone');
      
      fireEvent(dropZone, createDragEvent('dragover', { types: ['Files'] }));
      
      expect(dropZone).toHaveClass('border-cozy-accent', 'bg-cozy-mount', 'motion-safe:scale-105', 'shadow-cozy-card');
      expect(screen.getByText(/drop your photo here/i)).toBeInTheDocument();
    });

    it('shows upload icon when dragging over', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByTestId('drag-drop-zone');
      
      // Default icon is folder
      expect(screen.getByText('📁')).toBeInTheDocument();
      
      fireEvent(dropZone, createDragEvent('dragover', { types: ['Files'] }));
      
      // Should change to upload icon
      expect(screen.getByText('📤')).toBeInTheDocument();
    });
  });

  describe('Keyboard Accessibility', () => {
    it('opens file browser on Enter key', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByRole('button');
      const fileInput = screen.getByLabelText('File input') as HTMLInputElement;
      const clickSpy = jest.spyOn(fileInput, 'click');
      
      fireEvent.keyDown(dropZone, { key: 'Enter' });
      
      expect(clickSpy).toHaveBeenCalled();
    });

    it('opens file browser on Space key', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByRole('button');
      const fileInput = screen.getByLabelText('File input') as HTMLInputElement;
      const clickSpy = jest.spyOn(fileInput, 'click');
      
      fireEvent.keyDown(dropZone, { key: ' ' });
      
      expect(clickSpy).toHaveBeenCalled();
    });

    it('does not open file browser on other keys', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByRole('button');
      const fileInput = screen.getByLabelText('File input') as HTMLInputElement;
      const clickSpy = jest.spyOn(fileInput, 'click');
      
      fireEvent.keyDown(dropZone, { key: 'Tab' });
      
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('has correct tabIndex when enabled', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByRole('button');
      expect(dropZone).toHaveAttribute('tabIndex', '0');
    });

    it('has correct tabIndex when disabled', () => {
      render(<DragDropZone {...defaultProps} disabled={true} />);
      
      const dropZone = screen.getByRole('button');
      expect(dropZone).toHaveAttribute('tabIndex', '-1');
    });
  });

  describe('HEIC File Handling', () => {
    it('accepts HEIC file with correct MIME type', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByTestId('drag-drop-zone');
      const file = createMockFile('photo.heic', 'image/heic', FILE_SIZES.VALID);
      
      const dropEvent = createDragEvent('drop', {
        types: ['Files'],
        files: [file]
      });
      
      fireEvent(dropZone, dropEvent);
      
      expect(mockOnFileSelect).toHaveBeenCalledWith(file);
    });

    it('accepts HEIC file with empty MIME type (iOS Safari fallback)', () => {
      // This tests the extension fallback in fileUtils
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByTestId('drag-drop-zone');
      // Create file with empty MIME type (simulates iOS Safari behavior)
      const file = createMockFile('photo.heic', '', FILE_SIZES.VALID);
      
      const dropEvent = createDragEvent('drop', {
        types: ['Files'],
        files: [file]
      });
      
      fireEvent(dropZone, dropEvent);
      
      // Should call validateFile which will use extension fallback
      expect(mockValidateFile).toHaveBeenCalledWith(
        file,
        defaultProps.maxSize,
        expect.any(Array)
      );
    });

    it('accepts HEIF file extension', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByTestId('drag-drop-zone');
      const file = createMockFile('photo.heif', 'image/heic', FILE_SIZES.VALID);
      
      const dropEvent = createDragEvent('drop', {
        types: ['Files'],
        files: [file]
      });
      
      fireEvent(dropZone, dropEvent);
      
      expect(mockOnFileSelect).toHaveBeenCalledWith(file);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty drop gracefully', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByTestId('drag-drop-zone');
      const dropEvent = createDragEvent('drop', {
        types: ['Files'],
        files: []
      });
      
      fireEvent(dropZone, dropEvent);
      
      expect(mockOnFileSelect).not.toHaveBeenCalled();
      expect(mockOnError).not.toHaveBeenCalled();
    });

    it('handles drag without files', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByTestId('drag-drop-zone');
      const dragEvent = createDragEvent('dragenter', { types: [] });
      
      fireEvent(dropZone, dragEvent);
      
      // Should remain idle
      expect(dropZone).toHaveAttribute('data-drag-state', 'idle');
    });

    it('handles validation error gracefully', () => {
      mockValidateFile.mockReturnValue({
        valid: false,
        error: 'Custom validation error'
      });
      
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByTestId('drag-drop-zone');
      const file = createMockFile('test.jpg', 'image/jpeg', FILE_SIZES.SMALL);
      
      const dropEvent = createDragEvent('drop', {
        types: ['Files'],
        files: [file]
      });
      
      fireEvent(dropZone, dropEvent);
      
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Custom validation error'
        })
      );
    });

    it('handles null files gracefully', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const fileInput = screen.getByLabelText('File input') as HTMLInputElement;
      
      fireEvent.change(fileInput, {
        target: { files: null }
      });
      
      expect(mockOnFileSelect).not.toHaveBeenCalled();
      expect(mockOnError).not.toHaveBeenCalled();
    });
  });

  describe('Aria Attributes', () => {
    it('has correct aria-label', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByRole('button');
      expect(dropZone).toHaveAttribute('aria-label', 'Drag and drop zone for photo upload');
    });

    it('has aria-disabled when disabled', () => {
      render(<DragDropZone {...defaultProps} disabled={true} />);
      
      const dropZone = screen.getByRole('button');
      expect(dropZone).toHaveAttribute('aria-disabled', 'true');
    });

    it('has aria-disabled false when enabled', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByRole('button');
      expect(dropZone).toHaveAttribute('aria-disabled', 'false');
    });
  });
});

/**
 * Helper function to create mock drag events
 */
function createDragEvent(
  type: string,
  options: {
    types?: string[];
    files?: File[];
  } = {}
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true }) as Event & {
    dataTransfer: {
      types: string[];
      files: FileList;
      items: Array<{ kind: string; type: string; getAsFile: () => File }>;
    };
  };
  
  (event as any).dataTransfer = {
    types: options.types || [],
    files: options.files ? createFileList(options.files) : createFileList([]),
    items: options.files
      ? options.files.map(file => ({
          kind: 'file',
          type: file.type,
          getAsFile: () => file
        }))
      : []
  };
  
  return event;
}

/**
 * Helper function to create mock File objects
 */
function createMockFile(name: string, type: string, size: number): File {
  const blob = new Blob(['mock content'], { type });
  Object.defineProperty(blob, 'name', { value: name });
  Object.defineProperty(blob, 'size', { value: size });
  return blob as File;
}

/**
 * Helper function to create FileList
 */
function createFileList(files: File[]): FileList {
  const list = {
    length: files.length,
    item: (index: number) => files[index] || null,
    ...files
  } as FileList;
  
  return list;
}
