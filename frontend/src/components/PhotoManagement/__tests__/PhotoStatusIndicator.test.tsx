import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhotoStatusIndicator } from '../PhotoStatusIndicator';
import { ProcessingStatus } from '../../../types/photo-management';

//

describe('PhotoStatusIndicator', () => {
  const defaultProps = {
    status: 'ready' as ProcessingStatus,
    progress: 0,
    estimatedTime: undefined,
    onRetry: undefined
  };

  describe('Status Display', () => {
    it('should display ready status correctly', () => {
      render(<PhotoStatusIndicator {...defaultProps} status="ready" />);
      
      expect(screen.getByText('✓')).toBeInTheDocument();
      expect(screen.getByText('Ready to Process')).toBeInTheDocument();
    });

    it('should display queued status correctly', () => {
      render(<PhotoStatusIndicator {...defaultProps} status="queued" />);
      
      expect(screen.getByText('⏱️')).toBeInTheDocument();
      expect(screen.getByText('In Queue')).toBeInTheDocument();
    });

    it('should display processing status correctly', () => {
      render(<PhotoStatusIndicator {...defaultProps} status="processing" />);
      
      expect(screen.getByText('⚙️')).toBeInTheDocument();
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    it('should display completed status correctly', () => {
      render(<PhotoStatusIndicator {...defaultProps} status="completed" />);
      
      expect(screen.getByText('✅')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('should display failed status correctly', () => {
      render(<PhotoStatusIndicator {...defaultProps} status="failed" />);
      
      expect(screen.getByText('❌')).toBeInTheDocument();
      expect(screen.getByText('Failed - Tap to Retry')).toBeInTheDocument();
    });
  });

  describe('Progress Bar', () => {
    it('should show progress bar for processing status', () => {
      render(
        <PhotoStatusIndicator 
          {...defaultProps} 
          status="processing" 
          progress={50} 
        />
      );
      
      const progressBar = screen.getByRole('progressbar', { hidden: true });
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveStyle({ width: '50%' });
    });

    it('should not show progress bar for non-processing status', () => {
      render(<PhotoStatusIndicator {...defaultProps} status="ready" progress={50} />);
      
      const progressBar = screen.queryByRole('progressbar', { hidden: true });
      expect(progressBar).not.toBeInTheDocument();
    });

    it('should cap progress at 100%', () => {
      render(
        <PhotoStatusIndicator 
          {...defaultProps} 
          status="processing" 
          progress={150} 
        />
      );
      
      const progressBar = screen.getByRole('progressbar', { hidden: true });
      expect(progressBar).toHaveStyle({ width: '100%' });
    });

    it('should not show progress bar when progress is 0', () => {
      render(
        <PhotoStatusIndicator 
          {...defaultProps} 
          status="processing" 
          progress={0} 
        />
      );
      
      const progressBar = screen.queryByRole('progressbar', { hidden: true });
      expect(progressBar).not.toBeInTheDocument();
    });
  });

  describe('Estimated Time', () => {
    it('should display estimated time in seconds', () => {
      render(
        <PhotoStatusIndicator 
          {...defaultProps} 
          status="processing" 
          estimatedTime={30} 
        />
      );
      
      expect(screen.getByText('(30s)')).toBeInTheDocument();
    });

    it('should display estimated time in minutes', () => {
      render(
        <PhotoStatusIndicator 
          {...defaultProps} 
          status="processing" 
          estimatedTime={90} 
        />
      );
      
      expect(screen.getByText('(2m)')).toBeInTheDocument();
    });

    it('should display estimated time in hours', () => {
      render(
        <PhotoStatusIndicator 
          {...defaultProps} 
          status="processing" 
          estimatedTime={7200} 
        />
      );
      
      expect(screen.getByText('(2h)')).toBeInTheDocument();
    });

    it('should not display estimated time when not provided', () => {
      render(<PhotoStatusIndicator {...defaultProps} status="processing" />);
      
      expect(screen.queryByText(/\(\d+[smh]\)/)).not.toBeInTheDocument();
    });
  });

  describe('Retry Functionality', () => {
    it('should show retry button for failed status', () => {
      const mockOnRetry = jest.fn();
      render(
        <PhotoStatusIndicator 
          {...defaultProps} 
          status="failed" 
          onRetry={mockOnRetry} 
        />
      );
      
      const retryButton = screen.getByText('Retry');
      expect(retryButton).toBeInTheDocument();
    });

    it('should not show retry button for non-failed status', () => {
      render(<PhotoStatusIndicator {...defaultProps} status="ready" />);
      
      const retryButton = screen.queryByText('Retry');
      expect(retryButton).not.toBeInTheDocument();
    });

    it('should not show retry button when onRetry is not provided', () => {
      render(<PhotoStatusIndicator {...defaultProps} status="failed" />);
      
      const retryButton = screen.queryByText('Retry');
      expect(retryButton).not.toBeInTheDocument();
    });

    it('should call onRetry when retry button is clicked', () => {
      const mockOnRetry = jest.fn();
      render(
        <PhotoStatusIndicator 
          {...defaultProps} 
          status="failed" 
          onRetry={mockOnRetry} 
        />
      );
      
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);
      
      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    it('should stop event propagation when retry button is clicked', () => {
      const mockOnRetry = jest.fn();
      const mockParentClick = jest.fn();
      
      render(
        <div onClick={mockParentClick}>
          <PhotoStatusIndicator 
            {...defaultProps} 
            status="failed" 
            onRetry={mockOnRetry} 
          />
        </div>
      );
      
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);
      
      expect(mockOnRetry).toHaveBeenCalledTimes(1);
      expect(mockParentClick).not.toHaveBeenCalled();
    });
  });

  describe('CSS Classes and Styling', () => {
    it('should apply correct CSS classes for ready status', () => {
      render(<PhotoStatusIndicator {...defaultProps} status="ready" />);
      
      const statusBadge = screen.getByText('Ready to Process').closest('div');
      expect(statusBadge).toHaveClass('text-cozySemantic-success', 'bg-cozy-mount');
    });

    it('should apply correct CSS classes for queued status', () => {
      render(<PhotoStatusIndicator {...defaultProps} status="queued" />);
      
      const statusBadge = screen.getByText('In Queue').closest('div');
      expect(statusBadge).toHaveClass('text-cozy-accentDark', 'bg-cozy-mount', 'animate-pulse');
    });

    it('should apply correct CSS classes for processing status', () => {
      render(<PhotoStatusIndicator {...defaultProps} status="processing" />);
      
      const statusBadge = screen.getByText('Processing...').closest('div');
      expect(statusBadge).toHaveClass('text-cozySemantic-warning', 'bg-cozy-mount', 'animate-spin');
    });

    it('should apply correct CSS classes for completed status', () => {
      render(<PhotoStatusIndicator {...defaultProps} status="completed" />);
      
      const statusBadge = screen.getByText('Completed').closest('div');
      expect(statusBadge).toHaveClass('text-cozySemantic-success', 'bg-cozy-mount', 'animate-bounce');
    });

    it('should apply correct CSS classes for failed status', () => {
      render(<PhotoStatusIndicator {...defaultProps} status="failed" />);
      
      const statusBadge = screen.getByText('Failed - Tap to Retry').closest('div');
      expect(statusBadge).toHaveClass('text-cozySemantic-error', 'bg-cozy-mount', 'animate-shake');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for progress bar', () => {
      render(
        <PhotoStatusIndicator 
          {...defaultProps} 
          status="processing" 
          progress={50} 
        />
      );
      
      const progressBar = screen.getByRole('progressbar', { hidden: true });
      expect(progressBar).toBeInTheDocument();
    });

    it('should have proper button attributes for retry button', () => {
      const mockOnRetry = jest.fn();
      render(
        <PhotoStatusIndicator 
          {...defaultProps} 
          status="failed" 
          onRetry={mockOnRetry} 
        />
      );
      
      const retryButton = screen.getByText('Retry');
      expect(retryButton).toBeInTheDocument();
      expect(retryButton.tagName).toBe('BUTTON');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined status gracefully', () => {
      render(<PhotoStatusIndicator {...defaultProps} status={undefined as any} />);
      
      // Should fallback to ready status
      expect(screen.getByText('Ready to Process')).toBeInTheDocument();
    });

    it('should handle negative progress values', () => {
      render(
        <PhotoStatusIndicator 
          {...defaultProps} 
          status="processing" 
          progress={-10} 
        />
      );
      
      const progressBar = screen.queryByRole('progressbar', { hidden: true });
      expect(progressBar).not.toBeInTheDocument();
    });

    it('should handle very large progress values', () => {
      render(
        <PhotoStatusIndicator 
          {...defaultProps} 
          status="processing" 
          progress={1000} 
        />
      );
      
      const progressBar = screen.getByRole('progressbar', { hidden: true });
      expect(progressBar).toHaveStyle({ width: '100%' });
    });
  });

  describe('Animation Classes', () => {
    it('should apply animation classes correctly', () => {
      const { rerender } = render(<PhotoStatusIndicator {...defaultProps} status="queued" />);
      
      let statusBadge = screen.getByText('In Queue').closest('div');
      expect(statusBadge).toHaveClass('animate-pulse');
      
      rerender(<PhotoStatusIndicator {...defaultProps} status="processing" />);
      statusBadge = screen.getByText('Processing...').closest('div');
      expect(statusBadge).toHaveClass('animate-spin');
      
      rerender(<PhotoStatusIndicator {...defaultProps} status="completed" />);
      statusBadge = screen.getByText('Completed').closest('div');
      expect(statusBadge).toHaveClass('animate-bounce');
      
      rerender(<PhotoStatusIndicator {...defaultProps} status="failed" />);
      statusBadge = screen.getByText('Failed - Tap to Retry').closest('div');
      expect(statusBadge).toHaveClass('animate-shake');
    });
  });
});
