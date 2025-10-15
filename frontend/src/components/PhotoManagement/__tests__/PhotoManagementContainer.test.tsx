import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PhotoManagementContainer } from '../PhotoManagementContainer';
import { photoManagementService, creditManagementService, processingJobService } from '../../../services/photoManagementService';

// Mock the services
jest.mock('../../../services/photoManagementService', () => ({
  photoManagementService: {
    getPhotos: jest.fn(),
    getPhotoDetails: jest.fn(),
    deletePhoto: jest.fn(),
    deletePhotoResult: jest.fn(),
    downloadPhoto: jest.fn(),
    getPhotoMetadata: jest.fn(),
  },
  creditManagementService: {
    getCreditBalance: jest.fn(),
    calculateProcessingCost: jest.fn(),
    checkCreditAvailability: jest.fn(),
    deductCredits: jest.fn(),
    getCreditUsageBreakdown: jest.fn(),
  },
  processingJobService: {
    createProcessingJob: jest.fn(),
    getJobStatus: jest.fn(),
    cancelJob: jest.fn(),
    retryJob: jest.fn(),
    getProcessingHistory: jest.fn(),
  },
}));

// Mock the child components
jest.mock('../PhotoGallery', () => ({
  PhotoGallery: ({
    photos,
    onPhotoClick,
    onLoadMore,
    hasMore,
    isLoading,
    onRefresh,
    isRefreshing
  }: {
    photos: Array<{ id: string; originalFilename: string }>; 
    onPhotoClick: (photo: { id: string; originalFilename: string }) => void;
    onLoadMore: () => void;
    hasMore: boolean;
    isLoading: boolean;
    onRefresh: () => void;
    isRefreshing: boolean;
  }) => (
    <div data-testid="photo-gallery">
      <div data-testid="photo-count">{photos.length}</div>
      <button data-testid="load-more" onClick={onLoadMore} disabled={!hasMore || isLoading}>
        Load More
      </button>
      <button data-testid="refresh" onClick={onRefresh} disabled={isRefreshing}>
        Refresh
      </button>
      {photos.map((photo) => (
        <div key={photo.id} data-testid={`photo-${photo.id}`} onClick={() => onPhotoClick(photo)}>
          {photo.originalFilename}
        </div>
      ))}
    </div>
  ),
}));

jest.mock('../PhotoDetailDrawer', () => ({
  PhotoDetailDrawer: ({
    isOpen,
    photo,
    onClose,
    onPhotoAction,
    onProcessingStart
  }: {
    isOpen: boolean;
    photo: { id: string; originalFilename: string } | null;
    onClose: () => void;
    onPhotoAction: (action: string, photo: { id: string; originalFilename: string }) => void;
    onProcessingStart: (options: any) => void;
  }) => (
    isOpen ? (
      <div data-testid="photo-detail-drawer">
        <div data-testid="selected-photo">{photo?.originalFilename}</div>
        <button data-testid="close-drawer" onClick={onClose}>Close</button>
        <button data-testid="download-photo" onClick={() => onPhotoAction('download', photo)}>Download</button>
        <button data-testid="delete-photo" onClick={() => onPhotoAction('delete', photo)}>Delete</button>
        <button data-testid="process-photo" onClick={() => onProcessingStart({ restore: true })}>Process</button>
      </div>
    ) : null
  ),
}));

jest.mock('../CreditBalanceDisplay', () => ({
  CreditBalanceDisplay: ({
    balance,
    onPurchaseCredits,
    onViewSubscription,
    showWarning
  }: {
    balance: { subscriptionCredits: number; topupCredits: number };
    onPurchaseCredits: () => void;
    onViewSubscription: () => void;
    showWarning: boolean;
  }) => (
    <div data-testid="credit-balance-display">
      <div data-testid="subscription-credits">{balance.subscriptionCredits}</div>
      <div data-testid="topup-credits">{balance.topupCredits}</div>
      {showWarning && <div data-testid="credit-warning">Low credits</div>}
      <button data-testid="purchase-credits" onClick={onPurchaseCredits}>Purchase Credits</button>
      <button data-testid="view-subscription" onClick={onViewSubscription}>View Subscription</button>
    </div>
  ),
}));

const mockPhotos = [
  {
    id: '1',
    userId: 'user1',
    originalFilename: 'test1.jpg',
    fileKey: 'file1',
    thumbnailKey: 'thumb1',
    status: 'completed' as const,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    metadata: {
      dimensions: { width: 100, height: 100 },
      fileSize: 1000,
      format: 'jpg',
      uploadMethod: 'camera' as const,
      originalUrl: 'url1',
      thumbnailUrl: 'thumbUrl1'
    },
    results: [],
    processingJobs: []
  },
  {
    id: '2',
    userId: 'user1',
    originalFilename: 'test2.jpg',
    fileKey: 'file2',
    thumbnailKey: 'thumb2',
    status: 'processing' as const,
    createdAt: new Date('2023-01-02'),
    updatedAt: new Date('2023-01-02'),
    metadata: {
      dimensions: { width: 200, height: 200 },
      fileSize: 2000,
      format: 'jpg',
      uploadMethod: 'gallery' as const,
      originalUrl: 'url2',
      thumbnailUrl: 'thumbUrl2'
    },
    results: [],
    processingJobs: []
  }
];

const mockCreditBalance = {
  totalCredits: 100,
  subscriptionCredits: 50,
  topupCredits: 50,
  subscriptionTier: 'remember' as const,
  monthlyResetDate: new Date('2023-02-01'),
  lowCreditWarning: false,
  creditHistory: [],
  usageRules: {
    subscriptionFirst: true,
    subscriptionExpires: true,
    topupCarryOver: true
  }
};

describe('PhotoManagementContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock implementations
    (photoManagementService.getPhotos as jest.Mock).mockResolvedValue(mockPhotos);
    (creditManagementService.getCreditBalance as jest.Mock).mockResolvedValue(mockCreditBalance);
    (creditManagementService.calculateProcessingCost as jest.Mock).mockResolvedValue({
      totalCost: 5,
      availableCredits: 100,
      creditUsage: {
        subscriptionCreditsUsed: 5,
        topupCreditsUsed: 0,
        subscriptionCreditsRemaining: 45,
        topupCreditsRemaining: 50
      }
    });
    (processingJobService.createProcessingJob as jest.Mock).mockResolvedValue({
      id: 'job1',
      photoId: '1',
      userId: 'user1',
      options: { restore: true },
      status: 'queued',
      priority: 1,
      costCredits: 5,
      createdAt: new Date(),
      resultIds: []
    });
  });

  it('renders loading state initially', async () => {
    render(<PhotoManagementContainer userId="user1" />);
    
    expect(screen.getByText('Loading your photos...')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByTestId('photo-gallery')).toBeInTheDocument();
    });
  });

  it('loads and displays photos', async () => {
    render(<PhotoManagementContainer userId="user1" />);
    
    await waitFor(() => {
      expect(photoManagementService.getPhotos).toHaveBeenCalledWith('user1', {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    });
    
    expect(screen.getByTestId('photo-count')).toHaveTextContent('2');
    expect(screen.getByTestId('photo-1')).toHaveTextContent('test1.jpg');
    expect(screen.getByTestId('photo-2')).toHaveTextContent('test2.jpg');
  });

  it('displays credit balance', async () => {
    render(<PhotoManagementContainer userId="user1" />);
    
    await waitFor(() => {
      expect(creditManagementService.getCreditBalance).toHaveBeenCalledWith('user1');
    });
    
    expect(screen.getByTestId('subscription-credits')).toHaveTextContent('50');
    expect(screen.getByTestId('topup-credits')).toHaveTextContent('50');
  });

  it('handles photo selection and opens drawer', async () => {
    render(<PhotoManagementContainer userId="user1" />);
    
    await waitFor(() => {
      expect(screen.getByTestId('photo-gallery')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('photo-1'));
    
    expect(screen.getByTestId('photo-detail-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('selected-photo')).toHaveTextContent('test1.jpg');
  });

  it('handles drawer close', async () => {
    render(<PhotoManagementContainer userId="user1" />);
    
    await waitFor(() => {
      expect(screen.getByTestId('photo-gallery')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('photo-1'));
    expect(screen.getByTestId('photo-detail-drawer')).toBeInTheDocument();
    
    fireEvent.click(screen.getByTestId('close-drawer'));
    expect(screen.queryByTestId('photo-detail-drawer')).not.toBeInTheDocument();
  });

  it('handles photo deletion', async () => {
    render(<PhotoManagementContainer userId="user1" />);
    
    await waitFor(() => {
      expect(screen.getByTestId('photo-gallery')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('photo-1'));
    fireEvent.click(screen.getByTestId('delete-photo'));
    
    expect(photoManagementService.deletePhoto).toHaveBeenCalledWith('1');
  });

  it('handles processing start', async () => {
    render(<PhotoManagementContainer userId="user1" />);
    
    await waitFor(() => {
      expect(screen.getByTestId('photo-gallery')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('photo-1'));
    fireEvent.click(screen.getByTestId('process-photo'));
    
    await waitFor(() => {
      expect(creditManagementService.calculateProcessingCost).toHaveBeenCalledWith({ restore: true });
      expect(processingJobService.createProcessingJob).toHaveBeenCalledWith('1', { restore: true });
      expect(creditManagementService.deductCredits).toHaveBeenCalledWith('user1', 5);
    });
  });

  it('handles load more photos', async () => {
    // Mock to return exactly 20 photos (limit) so hasMore is true)
    const manyPhotos = Array.from({ length: 20 }, (_, i) => ({
      ...mockPhotos[0],
      id: `photo-${i}`,
      originalFilename: `test${i}.jpg`
    }));
    
    (photoManagementService.getPhotos as jest.Mock)
      .mockResolvedValueOnce(manyPhotos) // Initial load returns 20 photos
      .mockResolvedValueOnce([]); // Load more returns empty array
    
    render(<PhotoManagementContainer userId="user1" />);
    
    await waitFor(() => {
      expect(screen.getByTestId('photo-gallery')).toBeInTheDocument();
    });
    
    // Wait for initial load to complete
    await waitFor(() => {
      expect(photoManagementService.getPhotos).toHaveBeenCalledWith('user1', {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    });
    
    // The load more button should be enabled now
    const loadMoreButton = screen.getByTestId('load-more');
    expect(loadMoreButton).not.toBeDisabled();
    
    fireEvent.click(loadMoreButton);
    
    await waitFor(() => {
      expect(photoManagementService.getPhotos).toHaveBeenCalledWith('user1', {
        page: 2,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    });
  });

  it('handles refresh', async () => {
    render(<PhotoManagementContainer userId="user1" />);
    
    await waitFor(() => {
      expect(screen.getByTestId('photo-gallery')).toBeInTheDocument();
    });
    
    // Clear previous calls
    jest.clearAllMocks();
    
    fireEvent.click(screen.getByTestId('refresh'));
    
    await waitFor(() => {
      expect(photoManagementService.getPhotos).toHaveBeenCalledWith('user1', {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
      expect(creditManagementService.getCreditBalance).toHaveBeenCalledWith('user1');
    });
  });

  it('displays empty state when no photos', async () => {
    (photoManagementService.getPhotos as jest.Mock).mockResolvedValue([]);
    
    render(<PhotoManagementContainer userId="user1" />);
    
    await waitFor(() => {
      expect(screen.getByText('No photos yet')).toBeInTheDocument();
      expect(screen.getByText('Upload your first photo to get started')).toBeInTheDocument();
    });
  });

  it('displays error state when loading fails', async () => {
    (photoManagementService.getPhotos as jest.Mock).mockRejectedValue(new Error('Network error'));
    
    render(<PhotoManagementContainer userId="user1" />);
    
    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Failed to load initial data: Failed to load photos: Network error')).toBeInTheDocument();
    });
  });

  it('handles credit purchase navigation', async () => {
    render(<PhotoManagementContainer userId="user1" />);
    
    await waitFor(() => {
      expect(screen.getByTestId('credit-balance-display')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('purchase-credits'));
    // Should not throw error
  });

  it('handles subscription view navigation', async () => {
    render(<PhotoManagementContainer userId="user1" />);
    
    await waitFor(() => {
      expect(screen.getByTestId('credit-balance-display')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('view-subscription'));
    // Should not throw error
  });

  it('shows credit warning when low credits', async () => {
    const lowCreditBalance = {
      ...mockCreditBalance,
      lowCreditWarning: true
    };
    (creditManagementService.getCreditBalance as jest.Mock).mockResolvedValue(lowCreditBalance);
    
    render(<PhotoManagementContainer userId="user1" />);
    
    await waitFor(() => {
      expect(screen.getByTestId('credit-warning')).toBeInTheDocument();
    });
  });

  it('calls onPhotoSelect callback when photo is selected', async () => {
    const onPhotoSelect = jest.fn();
    render(<PhotoManagementContainer userId="user1" onPhotoSelect={onPhotoSelect} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('photo-gallery')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('photo-1'));
    
    expect(onPhotoSelect).toHaveBeenCalledWith(mockPhotos[0]);
  });

  it('calls onProcessingComplete callback when processing starts', async () => {
    const onProcessingComplete = jest.fn();
    render(<PhotoManagementContainer userId="user1" onProcessingComplete={onProcessingComplete} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('photo-gallery')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('photo-1'));
    fireEvent.click(screen.getByTestId('process-photo'));
    
    await waitFor(() => {
      expect(onProcessingComplete).toHaveBeenCalledWith({
        photoId: '1',
        resultId: 'job1',
        resultType: 'processing',
        fileUrl: '',
        thumbnailUrl: ''
      });
    });
  });

  it('calls onError callback when error occurs', async () => {
    const onError = jest.fn();
    (photoManagementService.getPhotos as jest.Mock).mockRejectedValue(new Error('Test error'));
    
    render(<PhotoManagementContainer userId="user1" onError={onError} />);
    
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith({
        type: 'load_error',
        message: 'Failed to load initial data: Failed to load photos: Test error',
        retryable: true,
        action: 'retry'
      });
    });
  });
});
