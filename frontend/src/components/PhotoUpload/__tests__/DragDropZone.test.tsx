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
 * - Disabled state handling
 * - Keyboard accessibility
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DragDropZone } from '../DragDropZone';
import { ErrorType } from '../../../types/upload';

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
  });

  describe('Drag and Drop Events', () => {
    it('handles drag enter event', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByRole('button');
      const dragEvent = createDragEvent('dragenter', { types: ['Files'] });
      
      fireEvent(dropZone, dragEvent);
      
      expect(dropZone).toHaveClass('border-blue-400', 'bg-blue-50');
    });

    it('handles drag over event', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByRole('button');
      const dragEvent = createDragEvent('dragover', { types: ['Files'] });
      
      fireEvent(dropZone, dragEvent);
      
      expect(dropZone).toHaveClass('border-blue-500', 'bg-blue-50');
    });

    it('handles drag leave event', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByRole('button');
      
      // First enter drag
      fireEvent(dropZone, createDragEvent('dragenter', { types: ['Files'] }));
      expect(dropZone).toHaveClass('border-blue-400');
      
      // Then leave drag
      const leaveEvent = createDragEvent('dragleave', { types: ['Files'] });
      Object.defineProperty(leaveEvent, 'clientX', { value: -1 });
      Object.defineProperty(leaveEvent, 'clientY', { value: -1 });
      
      fireEvent(dropZone, leaveEvent);
      
      // Should reset to default state
      expect(dropZone).not.toHaveClass('border-blue-400', 'bg-blue-50');
    });

    it('handles drop event with valid file', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByRole('button');
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      
      const dropEvent = createDragEvent('drop', {
        types: ['Files'],
        files: [file]
      });
      
      fireEvent(dropZone, dropEvent);
      
      expect(mockOnFileSelect).toHaveBeenCalledWith(file);
      expect(mockOnError).not.toHaveBeenCalled();
    });

    it('handles drop event with invalid file type', () => {
      mockValidateFile.mockReturnValue({
        valid: false,
        error: 'Unsupported file type. Allowed: image/jpeg, image/png, image/heic, image/webp'
      });
      
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByRole('button');
      const file = createMockFile('test.txt', 'text/plain', 1024);
      
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
      
      const dropZone = screen.getByRole('button');
      const file = createMockFile('large.jpg', 'image/jpeg', 100 * 1024 * 1024); // 100MB
      
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
      
      const dropZone = screen.getByRole('button');
      const file1 = createMockFile('test1.jpg', 'image/jpeg', 1024);
      const file2 = createMockFile('test2.jpg', 'image/jpeg', 2048);
      
      const dropEvent = createDragEvent('drop', {
        types: ['Files'],
        files: [file1, file2]
      });
      
      fireEvent(dropZone, dropEvent);
      
      expect(mockOnFileSelect).toHaveBeenCalledTimes(1);
      expect(mockOnFileSelect).toHaveBeenCalledWith(file1);
    });

    it('ignores drag events when disabled', () => {
      render(<DragDropZone {...defaultProps} disabled={true} />);
      
      const dropZone = screen.getByRole('button');
      const dragEvent = createDragEvent('dragenter', { types: ['Files'] });
      
      fireEvent(dropZone, dragEvent);
      
      // Should not have drag-over styling
      expect(dropZone).not.toHaveClass('border-blue-400', 'bg-blue-50');
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
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      
      fireEvent.change(fileInput, {
        target: { files: [file] }
      });
      
      expect(mockOnFileSelect).toHaveBeenCalledWith(file);
    });

    it('resets file input after selection', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const fileInput = screen.getByLabelText('File input') as HTMLInputElement;
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      
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
    it('shows drag-over state with correct styling', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByRole('button');
      
      fireEvent(dropZone, createDragEvent('dragover', { types: ['Files'] }));
      
      expect(dropZone).toHaveClass('border-blue-500', 'bg-blue-50', 'scale-105', 'shadow-lg');
      expect(screen.getByText(/drop your photo here/i)).toBeInTheDocument();
    });

    it('shows correct icon for drag-over state', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByRole('button');
      
      fireEvent(dropZone, createDragEvent('dragover', { types: ['Files'] }));
      
      // Should show upload icon (📤) when dragging over
      const icons = screen.getAllByText(/📤|📁/);
      expect(icons.length).toBeGreaterThan(0);
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

  describe('Edge Cases', () => {
    it('handles empty drop gracefully', () => {
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByRole('button');
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
      
      const dropZone = screen.getByRole('button');
      const dragEvent = createDragEvent('dragenter', { types: [] });
      
      fireEvent(dropZone, dragEvent);
      
      // Should not show drag-over state
      expect(dropZone).not.toHaveClass('border-blue-400');
    });

    it('handles validation error gracefully', () => {
      mockValidateFile.mockReturnValue({
        valid: false,
        error: 'Custom validation error'
      });
      
      render(<DragDropZone {...defaultProps} />);
      
      const dropZone = screen.getByRole('button');
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      
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
): DragEvent<HTMLDivElement> {
  const event = new Event(type, { bubbles: true, cancelable: true }) as any;
  
  event.dataTransfer = {
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
  
  return event as DragEvent<HTMLDivElement>;
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
