import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QuadrilateralCropper } from './QuadrilateralCropper';
import { CropAreaPixels } from './types';
import type { CornerPoints } from '../../types/jscanify';

describe('QuadrilateralCropper', () => {
  const mockProps = {
    image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
    onCropComplete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders cropper component with accept button', () => {
    render(<QuadrilateralCropper {...mockProps} />);
    
    expect(screen.getByText('✓ Crop')).toBeInTheDocument();
    expect(screen.getByAltText('Crop preview')).toBeInTheDocument();
  });

  it('renders in full-screen mode by default', () => {
    const { container } = render(<QuadrilateralCropper {...mockProps} />);
    
    const cropperContainer = container.firstChild as HTMLElement;
    expect(cropperContainer).toHaveClass('fixed', 'inset-0', 'z-50');
  });

  it('renders in non-full-screen mode when specified', () => {
    const { container } = render(<QuadrilateralCropper {...mockProps} isFullScreen={false} />);
    
    const cropperContainer = container.firstChild as HTMLElement;
    expect(cropperContainer).toHaveClass('relative', 'w-full', 'h-full');
  });

  it('shows cancel button when onCancel is provided', () => {
    const onCancel = jest.fn();
    render(<QuadrilateralCropper {...mockProps} onCancel={onCancel} />);
    
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('does not show cancel button when onCancel is not provided', () => {
    render(<QuadrilateralCropper {...mockProps} />);
    
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = jest.fn();
    render(<QuadrilateralCropper {...mockProps} onCancel={onCancel} />);
    
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Escape key is pressed', () => {
    const onCancel = jest.fn();
    render(<QuadrilateralCropper {...mockProps} onCancel={onCancel} />);
    
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCropComplete when Enter key is pressed', async () => {
    render(<QuadrilateralCropper {...mockProps} />);
    
    // Simulate image load
    const img = screen.getByAltText('Crop preview');
    fireEvent.load(img);
    
    // Wait for crop area to be initialized
    await waitFor(() => {
      expect(screen.getByText('✓ Crop')).not.toBeDisabled();
    });
    
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(mockProps.onCropComplete).toHaveBeenCalled();
  });

  it('prevents body scroll in full-screen mode', () => {
    const originalOverflow = document.body.style.overflow;
    
    const { unmount } = render(<QuadrilateralCropper {...mockProps} isFullScreen={true} />);
    
    expect(document.body.style.overflow).toBe('hidden');
    
    unmount();
    
    expect(document.body.style.overflow).toBe('unset');
    
    // Restore original value
    document.body.style.overflow = originalOverflow;
  });

  it('does not prevent body scroll in non-full-screen mode', () => {
    const originalOverflow = document.body.style.overflow;
    
    render(<QuadrilateralCropper {...mockProps} isFullScreen={false} />);
    
    expect(document.body.style.overflow).toBe(originalOverflow);
  });

  it('uses initial crop area when provided', () => {
    const initialCropArea: CropAreaPixels = { x: 50, y: 50, width: 200, height: 200 };
    render(<QuadrilateralCropper {...mockProps} initialCropArea={initialCropArea} />);
    
    // The component should use the provided initial crop area
    expect(screen.getByAltText('Crop preview')).toBeInTheDocument();
  });

  it('shows quadrilateral handles for crop adjustment', async () => {
    render(<QuadrilateralCropper {...mockProps} />);
    
    // Simulate image load
    const img = screen.getByAltText('Crop preview');
    fireEvent.load(img);
    
    // Wait for crop area to be initialized and handles to appear
    await waitFor(() => {
      const handles = document.querySelectorAll('.w-8.h-8.bg-blue-500');
      expect(handles).toHaveLength(4); // Four corner handles
    });
  });

  it('preserves image aspect ratio', async () => {
    render(<QuadrilateralCropper {...mockProps} />);
    
    // Simulate image load
    const img = screen.getByAltText('Crop preview');
    
    // Mock image dimensions
    Object.defineProperty(img, 'naturalWidth', { value: 800, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 600, configurable: true });
    
    fireEvent.load(img);
    
    // Wait for image to be positioned
    await waitFor(() => {
      expect(img).toHaveClass('object-contain');
    });
    
    // The image should have object-contain class
    expect(img).toHaveClass('object-contain');
  });

  describe('JScanify corner points integration', () => {
    const mockJScanifyCornerPoints: CornerPoints = {
      topLeftCorner: { x: 100, y: 100 },
      topRightCorner: { x: 300, y: 100 },
      bottomLeftCorner: { x: 100, y: 200 },
      bottomRightCorner: { x: 300, y: 200 }
    };

    it('uses JScanify corner points when provided', async () => {
      render(
        <QuadrilateralCropper 
          {...mockProps} 
          jscanifyCornerPoints={mockJScanifyCornerPoints}
          detectionConfidence={0.85}
        />
      );
      
      // Simulate image load
      const img = screen.getByAltText('Crop preview');
      fireEvent.load(img);
      
      // Wait for crop area to be initialized
      await waitFor(() => {
        expect(screen.getByText('✓ Crop')).not.toBeDisabled();
      });
      
      // The component should use JScanify corner points for initial crop area
      expect(screen.getByAltText('Crop preview')).toBeInTheDocument();
    });

    it('shows confidence indicator when JScanify corner points are provided', async () => {
      render(
        <QuadrilateralCropper 
          {...mockProps} 
          jscanifyCornerPoints={mockJScanifyCornerPoints}
          detectionConfidence={0.85}
        />
      );
      
      // Simulate image load
      const img = screen.getByAltText('Crop preview');
      fireEvent.load(img);
      
      // Wait for smart detection indicator to appear
      await waitFor(() => {
        expect(screen.getByText(/Smart detection ready/)).toBeInTheDocument();
        expect(screen.getByText(/85% confidence/)).toBeInTheDocument();
      });
    });

    it('prioritizes JScanify corner points over initial crop area', async () => {
      const initialCropArea: CropAreaPixels = { x: 50, y: 50, width: 200, height: 200 };
      
      render(
        <QuadrilateralCropper 
          {...mockProps} 
          initialCropArea={initialCropArea}
          jscanifyCornerPoints={mockJScanifyCornerPoints}
          detectionConfidence={0.9}
        />
      );
      
      // Simulate image load
      const img = screen.getByAltText('Crop preview');
      fireEvent.load(img);
      
      // Wait for crop area to be initialized
      await waitFor(() => {
        expect(screen.getByText('✓ Crop')).not.toBeDisabled();
      });
      
      // Should show smart detection indicator (JScanify takes priority)
      expect(screen.getByText(/Smart detection ready/)).toBeInTheDocument();
      expect(screen.getByText(/90% confidence/)).toBeInTheDocument();
    });

    it('falls back to initial crop area when JScanify corner points are not provided', async () => {
      const initialCropArea: CropAreaPixels = { x: 50, y: 50, width: 200, height: 200 };
      
      render(
        <QuadrilateralCropper 
          {...mockProps} 
          initialCropArea={initialCropArea}
        />
      );
      
      // Simulate image load
      const img = screen.getByAltText('Crop preview');
      fireEvent.load(img);
      
      // Wait for crop area to be initialized
      await waitFor(() => {
        expect(screen.getByText('✓ Crop')).not.toBeDisabled();
      });
      
      // Should not show smart detection indicator
      expect(screen.queryByText(/Smart detection ready/)).not.toBeInTheDocument();
    });

    it('allows manual adjustment of JScanify-detected crop area', async () => {
      render(
        <QuadrilateralCropper 
          {...mockProps} 
          jscanifyCornerPoints={mockJScanifyCornerPoints}
          detectionConfidence={0.75}
        />
      );
      
      // Simulate image load
      const img = screen.getByAltText('Crop preview');
      fireEvent.load(img);
      
      // Wait for crop area to be initialized and handles to appear
      await waitFor(() => {
        const handles = document.querySelectorAll('.w-8.h-8.bg-blue-500');
        expect(handles).toHaveLength(4); // Four corner handles should be present
      });
      
      // Users should still be able to manually adjust the crop area
      // even when JScanify corner points are provided
      expect(screen.getByText('✓ Crop')).not.toBeDisabled();
    });

    it('handles missing confidence gracefully', async () => {
      render(
        <QuadrilateralCropper 
          {...mockProps} 
          jscanifyCornerPoints={mockJScanifyCornerPoints}
        />
      );
      
      // Simulate image load
      const img = screen.getByAltText('Crop preview');
      fireEvent.load(img);
      
      // Wait for smart detection indicator to appear
      await waitFor(() => {
        expect(screen.getByText(/Smart detection ready/)).toBeInTheDocument();
        // Should not show confidence percentage when not provided
        expect(screen.queryByText(/confidence/)).not.toBeInTheDocument();
      });
    });
  });
});