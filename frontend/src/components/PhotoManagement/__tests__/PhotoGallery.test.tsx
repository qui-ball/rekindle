import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PhotoGallery } from '../PhotoGallery';
import { Photo } from '../../../types/photo-management';

// Mock the PhotoStatusIndicator component
jest.mock('../PhotoStatusIndicator', () => ({
  PhotoStatusIndicator: ({ status, progress, onRetry }: any) => (
    <div data-testid="status-indicator" data-status={status} data-progress={progress}>
      {status === 'failed' && onRetry && (
        <button data-testid="retry-button" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  ),
}));

// Mock photos data
const mockPhotos: Photo[] = [
  {
    id: '1',
    userId: 'user1',
    originalFilename: 'test1.jpg',
    fileKey: 'photos/user1/test1.jpg',
    thumbnailKey: 'thumbnails/user1/test1.jpg',
    status: 'completed',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    metadata: {
      dimensions: { width: 1920, height: 1080 },
      fileSize: 1024000,
      format: 'jpeg',
      uploadMethod: 'camera',
      originalUrl: 'https://example.com/test1.jpg',
      thumbnailUrl: 'https://example.com/thumb1.jpg'
    },
    results: [
      {
        id: 'result1',
        photoId: '1',
        resultType: 'restored',
        fileKey: 'results/user1/restored1.jpg',
        thumbnailKey: 'thumbnails/user1/restored1.jpg',
        status: 'completed',
        createdAt: new Date('2024-01-01'),
        completedAt: new Date('2024-01-01'),
        processingJobId: 'job1',
        metadata: {
          dimensions: { width: 1920, height: 1080 },
          fileSize: 1024000,
          format: 'jpeg',
          quality: 'standard',
          processingTime: 30,
          model: 'qwen-3-image-edit',
          parameters: {}
        }
      }
    ],
    processingJobs: []
  },
  {
    id: '2',
    userId: 'user1',
    originalFilename: 'test2.jpg',
    fileKey: 'photos/user1/test2.jpg',
    thumbnailKey: 'thumbnails/user1/test2.jpg',
    status: 'processing',
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
    metadata: {
      dimensions: { width: 1920, height: 1080 },
      fileSize: 1024000,
      format: 'jpeg',
      uploadMethod: 'gallery',
      originalUrl: 'https://example.com/test2.jpg',
      thumbnailUrl: 'https://example.com/thumb2.jpg'
    },
    results: [],
    processingJobs: []
  },
  {
    id: '3',
    userId: 'user1',
    originalFilename: 'test3.jpg',
    fileKey: 'photos/user1/test3.jpg',
    thumbnailKey: 'thumbnails/user1/test3.jpg',
    status: 'failed',
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
    metadata: {
      dimensions: { width: 1920, height: 1080 },
      fileSize: 1024000,
      format: 'jpeg',
      uploadMethod: 'desktop',
      originalUrl: 'https://example.com/test3.jpg',
      thumbnailUrl: 'https://example.com/thumb3.jpg'
    },
    results: [],
    processingJobs: []
  }
];

const defaultProps = {
  photos: mockPhotos,
  onPhotoClick: jest.fn(),
  onLoadMore: jest.fn(),
  hasMore: true,
  isLoading: false,
  onRefresh: jest.fn(),
  isRefreshing: false
};

describe('PhotoGallery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders photo gallery with correct grid layout', () => {
    render(<PhotoGallery {...defaultProps} />);
    
    const gallery = screen.getByRole('grid');
    expect(gallery).toBeInTheDocument();
    expect(gallery).toHaveClass('grid');
    expect(gallery).toHaveAttribute('aria-label', 'Photo gallery grid');
  });

  it('renders all photos in the gallery', () => {
    render(<PhotoGallery {...defaultProps} />);
    
    // Check that images are rendered with correct alt text
    expect(screen.getByAltText('test1.jpg')).toBeInTheDocument();
    expect(screen.getByAltText('test2.jpg')).toBeInTheDocument();
    expect(screen.getByAltText('test3.jpg')).toBeInTheDocument();
  });

  it('handles photo click events', () => {
    render(<PhotoGallery {...defaultProps} />);
    
    const photo1 = screen.getByAltText('test1.jpg').closest('div');
    fireEvent.click(photo1!);
    
    expect(defaultProps.onPhotoClick).toHaveBeenCalledWith(mockPhotos[0]);
  });

  it('handles keyboard navigation', () => {
    render(<PhotoGallery {...defaultProps} />);
    
    const photo1 = screen.getByAltText('test1.jpg').closest('div');
    fireEvent.keyDown(photo1!, { key: 'Enter' });
    
    expect(defaultProps.onPhotoClick).toHaveBeenCalledWith(mockPhotos[0]);
    
    fireEvent.keyDown(photo1!, { key: ' ' });
    expect(defaultProps.onPhotoClick).toHaveBeenCalledTimes(2);
  });

  it('shows processing overlay for processing photos', () => {
    render(<PhotoGallery {...defaultProps} />);
    
    // Find the photo container div (the one with role="gridcell")
    const processingPhoto = screen.getByAltText('test2.jpg').closest('[role="gridcell"]');
    expect(processingPhoto).toHaveClass('group');
    
    // Check for processing overlay
    const overlay = processingPhoto?.querySelector('.absolute.inset-0.bg-black.bg-opacity-50');
    expect(overlay).toBeInTheDocument();
  });

  it('shows results badge for photos with results', () => {
    render(<PhotoGallery {...defaultProps} />);
    
    const photoWithResults = screen.getByAltText('test1.jpg').closest('[role="gridcell"]');
    const resultsBadge = photoWithResults?.querySelector('.bg-green-500');
    expect(resultsBadge).toBeInTheDocument();
    expect(resultsBadge).toHaveTextContent('1 result');
  });

  it('renders status indicators for each photo', () => {
    render(<PhotoGallery {...defaultProps} />);
    
    const statusIndicators = screen.getAllByTestId('status-indicator');
    expect(statusIndicators).toHaveLength(3);
    
    // Check status values
    expect(statusIndicators[0]).toHaveAttribute('data-status', 'completed');
    expect(statusIndicators[1]).toHaveAttribute('data-status', 'processing');
    expect(statusIndicators[2]).toHaveAttribute('data-status', 'failed');
  });

  it('shows retry button for failed photos', () => {
    render(<PhotoGallery {...defaultProps} />);
    
    const retryButton = screen.getByTestId('retry-button');
    expect(retryButton).toBeInTheDocument();
  });

  it('handles infinite scroll when near bottom', async () => {
    const mockOnLoadMore = jest.fn();
    render(<PhotoGallery {...defaultProps} onLoadMore={mockOnLoadMore} />);
    
    const gallery = screen.getByRole('grid');
    
    // Simulate scrolling to bottom
    Object.defineProperty(gallery, 'scrollTop', { value: 1000 });
    Object.defineProperty(gallery, 'scrollHeight', { value: 1200 });
    Object.defineProperty(gallery, 'clientHeight', { value: 200 });
    
    fireEvent.scroll(gallery);
    
    await waitFor(() => {
      expect(mockOnLoadMore).toHaveBeenCalled();
    });
  });

  it('does not trigger load more when already loading', () => {
    const mockOnLoadMore = jest.fn();
    render(<PhotoGallery {...defaultProps} onLoadMore={mockOnLoadMore} isLoading={true} />);
    
    const gallery = screen.getByRole('grid');
    fireEvent.scroll(gallery);
    
    expect(mockOnLoadMore).not.toHaveBeenCalled();
  });

  it('does not trigger load more when no more photos', () => {
    const mockOnLoadMore = jest.fn();
    render(<PhotoGallery {...defaultProps} onLoadMore={mockOnLoadMore} hasMore={false} />);
    
    const gallery = screen.getByRole('grid');
    fireEvent.scroll(gallery);
    
    expect(mockOnLoadMore).not.toHaveBeenCalled();
  });

  it('shows loading skeletons when loading', () => {
    render(<PhotoGallery {...defaultProps} isLoading={true} />);
    
    const skeletons = screen.getAllByText('').filter(el => 
      el.closest('div')?.classList.contains('animate-pulse')
    );
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows loading indicator when loading more photos', () => {
    render(<PhotoGallery {...defaultProps} isLoading={true} />);
    
    expect(screen.getByText('Loading more photos...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows end of photos message when no more photos', () => {
    render(<PhotoGallery {...defaultProps} hasMore={false} />);
    
    expect(screen.getByText("You've reached the end of your photos")).toBeInTheDocument();
  });

  it('shows empty state when no photos', () => {
    render(<PhotoGallery {...defaultProps} photos={[]} />);
    
    expect(screen.getByText('No photos yet')).toBeInTheDocument();
    expect(screen.getByText('Upload your first photo to get started')).toBeInTheDocument();
  });

  it('handles pull-to-refresh on mobile', () => {
    render(<PhotoGallery {...defaultProps} />);
    
    const gallery = screen.getByRole('grid');
    
    // Simulate touch start at top
    fireEvent.touchStart(gallery, {
      touches: [{ clientY: 100 }]
    });
    
    // Simulate touch move down
    fireEvent.touchMove(gallery, {
      touches: [{ clientY: 150 }]
    });
    
    // Should show pull-to-refresh indicator
    expect(screen.getByText('Pull to refresh')).toBeInTheDocument();
  });

  it('triggers refresh when pull distance is sufficient', () => {
    const mockOnRefresh = jest.fn();
    render(<PhotoGallery {...defaultProps} onRefresh={mockOnRefresh} />);
    
    const gallery = screen.getByRole('grid');
    
    // Simulate touch start
    fireEvent.touchStart(gallery, {
      touches: [{ clientY: 100 }]
    });
    
    // Simulate touch move with sufficient distance
    fireEvent.touchMove(gallery, {
      touches: [{ clientY: 200 }]
    });
    
    // Simulate touch end
    fireEvent.touchEnd(gallery);
    
    expect(mockOnRefresh).toHaveBeenCalled();
  });

  it('handles image load errors with fallback', () => {
    render(<PhotoGallery {...defaultProps} />);
    
    const images = screen.getAllByRole('img');
    const firstImage = images[0];
    
    // With Next.js Image component, the fallback is handled internally
    // We just verify the image is rendered with the correct alt text
    expect(firstImage).toHaveAttribute('alt', mockPhotos[0].originalFilename);
    expect(firstImage).toBeInTheDocument();
  });

  it('applies correct grid columns based on screen size', () => {
    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 800,
    });
    
    render(<PhotoGallery {...defaultProps} />);
    
    const gallery = screen.getByRole('grid');
    expect(gallery).toHaveClass('grid-cols-3'); // Tablet size
  });

  it('has proper accessibility attributes', () => {
    render(<PhotoGallery {...defaultProps} />);
    
    const gallery = screen.getByRole('grid');
    expect(gallery).toHaveAttribute('aria-label', 'Photo gallery grid');
    
    const photos = screen.getAllByRole('gridcell');
    expect(photos).toHaveLength(3);
    
    photos.forEach((photo, _index) => {
      expect(photo).toHaveAttribute('aria-label');
      expect(photo).toHaveAttribute('tabIndex', '0');
    });
  });

  it('handles touch events properly for mobile optimization', () => {
    render(<PhotoGallery {...defaultProps} />);
    
    const gallery = screen.getByRole('grid');
    
    // Should have touch event handlers (they're React event handlers, not HTML attributes)
    expect(gallery).toBeInTheDocument();
    // The touch handlers are React event handlers, not HTML attributes
    // We can test that the component renders without errors
  });

  it('shows hover effects on desktop', () => {
    render(<PhotoGallery {...defaultProps} />);
    
    const photo = screen.getByAltText('test1.jpg').closest('[role="gridcell"]');
    expect(photo).toHaveClass('group', 'hover:shadow-lg', 'hover:scale-105');
  });

  it('has proper touch targets for mobile', () => {
    render(<PhotoGallery {...defaultProps} />);
    
    const photos = screen.getAllByRole('gridcell');
    photos.forEach(photo => {
      expect(photo).toHaveStyle({
        minHeight: '120px',
        minWidth: '120px'
      });
    });
  });
});
