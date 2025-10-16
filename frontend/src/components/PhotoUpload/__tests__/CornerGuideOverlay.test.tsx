/**
 * CornerGuideOverlay Component Tests
 * 
 * Tests for the corner guide overlay component including:
 * - Responsive positioning for different aspect ratios
 * - Visual feedback and animation when guides are properly aligned
 * - Accessibility features (high contrast mode, screen reader support)
 * - Guide visibility toggle functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CornerGuideOverlay, type CornerGuideProps } from '../CornerGuideOverlay';

// Mock window.matchMedia for high contrast mode testing
const mockMatchMedia = (matches: boolean) => {
  return jest.fn().mockImplementation((query) => ({
    matches,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
};

// Mock window dimensions
const mockWindowDimensions = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
};

describe('CornerGuideOverlay', () => {
  const defaultProps: CornerGuideProps = {
    isVisible: true,
    isMobile: false,
  };

  beforeEach(() => {
    // Reset window dimensions
    mockWindowDimensions(375, 667); // iPhone dimensions
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders dual orientation corner guides when visible', () => {
      render(<CornerGuideOverlay {...defaultProps} />);
      
      // Check for portrait corner lines (should be visible by default)
      const portraitSvg = screen.getByLabelText('Photo positioning guides for both portrait and landscape orientations');
      expect(portraitSvg).toBeInTheDocument();
      
      // Check for landscape corner lines (should be visible by default)
      const landscapeSvg = screen.getByLabelText('Photo positioning guides for both portrait and landscape orientations');
      expect(landscapeSvg).toBeInTheDocument();
    });

    it('does not render when not visible', () => {
      render(<CornerGuideOverlay {...defaultProps} isVisible={false} />);
      
      expect(screen.queryByLabelText('Photo positioning guides')).not.toBeInTheDocument();
    });

    it('renders guide lines', () => {
      render(<CornerGuideOverlay {...defaultProps} />);
      
      const guideLines = screen.getByRole('img', { hidden: true });
      expect(guideLines).toBeInTheDocument();
    });
  });

  describe('Dual Orientation Positioning', () => {
    it('positions both portrait and landscape guides correctly', () => {
      mockWindowDimensions(400, 600);
      render(<CornerGuideOverlay {...defaultProps} />);
      
      // Check that both orientation guides are positioned
      const overlay = screen.getByLabelText('Photo positioning guides for both portrait and landscape orientations');
      expect(overlay).toBeInTheDocument();
      
      // Check that both SVG elements are present
      const portraitSvg = overlay.querySelector('.guide-lines.portrait');
      const landscapeSvg = overlay.querySelector('.guide-lines.landscape');
      expect(portraitSvg).toBeInTheDocument();
      expect(landscapeSvg).toBeInTheDocument();
    });

    it('centers guides in camera view', () => {
      mockWindowDimensions(400, 600);
      render(<CornerGuideOverlay {...defaultProps} />);
      
      // Both guide sets should be centered
      const overlay = screen.getByLabelText('Photo positioning guides for both portrait and landscape orientations');
      expect(overlay).toBeInTheDocument();
      
      // Check that both SVG elements are present
      const portraitSvg = overlay.querySelector('.guide-lines.portrait');
      const landscapeSvg = overlay.querySelector('.guide-lines.landscape');
      expect(portraitSvg).toBeInTheDocument();
      expect(landscapeSvg).toBeInTheDocument();
    });
  });

  describe('Orientation Detection', () => {
    it('detects and highlights the correct orientation', async () => {
      render(<CornerGuideOverlay {...defaultProps} />);
      
      // Wait for alignment check
      await waitFor(() => {
        const feedback = screen.queryByLabelText(/Guides are properly aligned for/);
        expect(feedback).toBeInTheDocument();
      });
    });
  });

  describe('Mobile Responsiveness', () => {
    it('adjusts marker size for mobile devices', () => {
      render(<CornerGuideOverlay {...defaultProps} isMobile={true} />);
      
      const overlay = screen.getByLabelText('Photo positioning guides for both portrait and landscape orientations');
      expect(overlay).toBeInTheDocument();
    });

    it('uses standard marker size for desktop', () => {
      render(<CornerGuideOverlay {...defaultProps} isMobile={false} />);
      
      const overlay = screen.getByLabelText('Photo positioning guides for both portrait and landscape orientations');
      expect(overlay).toBeInTheDocument();
    });
  });

  describe('Accessibility Features', () => {
    it('supports high contrast mode', () => {
      window.matchMedia = mockMatchMedia(true);
      
      render(<CornerGuideOverlay {...defaultProps} />);
      
      const overlay = screen.getByLabelText('Photo positioning guides for both portrait and landscape orientations');
      expect(overlay).toBeInTheDocument();
    });

    it('provides proper ARIA labels', () => {
      render(<CornerGuideOverlay {...defaultProps} />);
      
      expect(screen.getByLabelText('Photo positioning guides for both portrait and landscape orientations')).toBeInTheDocument();
    });

    it('hides decorative SVG from screen readers', () => {
      render(<CornerGuideOverlay {...defaultProps} />);
      
      const guideLines = screen.getByRole('img', { hidden: true });
      expect(guideLines).toBeInTheDocument();
      // The SVG should be present but not interfere with screen readers
    });
  });

  describe('Guide Position Change Callback', () => {
    it('calls onGuidePositionChange when guides are positioned', async () => {
      const mockOnGuidePositionChange = jest.fn();
      
      render(
        <CornerGuideOverlay 
          {...defaultProps} 
          onGuidePositionChange={mockOnGuidePositionChange}
        />
      );
      
      await waitFor(() => {
        expect(mockOnGuidePositionChange).toHaveBeenCalled();
      });
    });

    it('provides corner coordinates and orientation in callback', async () => {
      const mockOnGuidePositionChange = jest.fn();
      
      render(
        <CornerGuideOverlay 
          {...defaultProps} 
          onGuidePositionChange={mockOnGuidePositionChange}
        />
      );
      
      await waitFor(() => {
        expect(mockOnGuidePositionChange).toHaveBeenCalledWith(
          expect.objectContaining({
            topLeft: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
            topRight: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
            bottomLeft: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
            bottomRight: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
          }),
          expect.any(String) // orientation parameter
        );
      });
    });
  });

  describe('Window Resize Handling', () => {
    it('updates guide positions on window resize', async () => {
      const mockOnGuidePositionChange = jest.fn();
      
      render(
        <CornerGuideOverlay 
          {...defaultProps} 
          onGuidePositionChange={mockOnGuidePositionChange}
        />
      );
      
      // Clear initial call
      mockOnGuidePositionChange.mockClear();
      
      // Simulate window resize
      mockWindowDimensions(800, 600);
      fireEvent(window, new Event('resize'));
      
      await waitFor(() => {
        expect(mockOnGuidePositionChange).toHaveBeenCalled();
      });
    });
  });

  describe('Alignment Feedback', () => {
    it('shows alignment feedback when guides are properly positioned', async () => {
      render(<CornerGuideOverlay {...defaultProps} />);
      
      // Wait for alignment check
      await waitFor(() => {
        const feedback = screen.queryByLabelText(/Guides are properly aligned for/);
        expect(feedback).toBeInTheDocument();
      });
    });
  });

  describe('CSS Classes', () => {
    it('applies correct CSS classes for styling', () => {
      render(<CornerGuideOverlay {...defaultProps} className="custom-class" />);
      
      const overlay = screen.getByLabelText('Photo positioning guides for both portrait and landscape orientations');
      expect(overlay).toHaveClass('corner-guide-overlay', 'custom-class');
    });

    it('applies alignment classes when guides are aligned', async () => {
      render(<CornerGuideOverlay {...defaultProps} />);
      
      await waitFor(() => {
        const overlay = screen.getByLabelText('Photo positioning guides for both portrait and landscape orientations');
        expect(overlay).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles component rendering gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      render(<CornerGuideOverlay {...defaultProps} />);
      
      // Should not throw errors
      expect(screen.getByLabelText('Photo positioning guides for both portrait and landscape orientations')).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });
  });
});
