import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProcessingOptionsPanel } from '../ProcessingOptionsPanel';
import { Photo, CreditBalance } from '../../../types/photo-management';

// Mock the ProcessingParameterDrawer component
jest.mock('../ProcessingParameterDrawer', () => {
  const MockDrawer = ({ isOpen, processingType }: { isOpen: boolean; processingType: string }) => {
    return isOpen ? <div data-testid={`parameter-drawer-${processingType}`}>Parameter Drawer</div> : null;
  };
  
  return {
    __esModule: true,
    ProcessingParameterDrawer: MockDrawer,
    default: MockDrawer
  };
});

describe('ProcessingOptionsPanel', () => {
  const mockPhoto: Photo = {
    id: '1',
    userId: 'user1',
    originalFilename: 'test.jpg',
    fileKey: 'test-key',
    thumbnailKey: 'test-thumb-key',
    status: 'completed',
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {
      dimensions: { width: 100, height: 100 },
      fileSize: 1000,
      format: 'jpg',
      uploadMethod: 'desktop',
      originalUrl: 'http://test.com/original.jpg',
      thumbnailUrl: 'http://test.com/thumb.jpg'
    },
    results: [],
    processingJobs: []
  };

  const mockCredits: CreditBalance = {
    totalCredits: 100,
    subscriptionTier: 'remember',
    lowCreditWarning: false,
    creditHistory: [],
    usageRules: {
      creditsCarryOver: true,
      lostOnCancellation: true
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render processing options', () => {
      render(
        <ProcessingOptionsPanel
          photo={mockPhoto}
          availableCredits={mockCredits}
          onOptionsChange={jest.fn()}
          onProcess={jest.fn()}
          isProcessing={false}
        />
      );

      expect(screen.getByText('Processing Options')).toBeInTheDocument();
      expect(screen.getByText('Restore')).toBeInTheDocument();
      expect(screen.getByText('Animate')).toBeInTheDocument();
      expect(screen.getByText('Bring Together')).toBeInTheDocument();
    });

    it('should show quality selection', () => {
      render(
        <ProcessingOptionsPanel
          photo={mockPhoto}
          availableCredits={mockCredits}
          onOptionsChange={jest.fn()}
          onProcess={jest.fn()}
          isProcessing={false}
        />
      );

      expect(screen.getByText(/Standard \(480p\)/)).toBeInTheDocument();
      expect(screen.getByText(/HD \(720p\)/)).toBeInTheDocument();
    });
  });

  describe('Option Selection', () => {
    it('should handle restore checkbox change', async () => {
      const mockOnChange = jest.fn();
      render(
        <ProcessingOptionsPanel
          photo={mockPhoto}
          availableCredits={mockCredits}
          onOptionsChange={mockOnChange}
          onProcess={jest.fn()}
          isProcessing={false}
        />
      );

      const restoreCheckbox = screen.getByRole('checkbox', { name: /restore/i });
      fireEvent.click(restoreCheckbox);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
        const options = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
        expect(options.restore).toBe(true);
      });
    });

    it('should handle animate checkbox change', async () => {
      const mockOnChange = jest.fn();
      render(
        <ProcessingOptionsPanel
          photo={mockPhoto}
          availableCredits={mockCredits}
          onOptionsChange={mockOnChange}
          onProcess={jest.fn()}
          isProcessing={false}
        />
      );

      const animateCheckbox = screen.getByRole('checkbox', { name: /animate/i });
      fireEvent.click(animateCheckbox);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
        const options = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
        expect(options.animate).toBe(true);
      });
    });

    it('should handle quality change', async () => {
      const mockOnChange = jest.fn();
      render(
        <ProcessingOptionsPanel
          photo={mockPhoto}
          availableCredits={mockCredits}
          onOptionsChange={mockOnChange}
          onProcess={jest.fn()}
          isProcessing={false}
        />
      );

      const hdRadio = screen.getByLabelText(/HD \(720p\)/);
      fireEvent.click(hdRadio);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
        const options = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
        expect(options.quality).toBe('hd');
      });
    });
  });

  describe('Parameter Drawers', () => {
    it('should show restore parameter drawer when restore is checked', async () => {
      render(
        <ProcessingOptionsPanel
          photo={mockPhoto}
          availableCredits={mockCredits}
          onOptionsChange={jest.fn()}
          onProcess={jest.fn()}
          isProcessing={false}
        />
      );

      const restoreCheckbox = screen.getByRole('checkbox', { name: /restore/i });
      fireEvent.click(restoreCheckbox);

      await waitFor(() => {
        expect(screen.getByTestId('parameter-drawer-restore')).toBeInTheDocument();
      });
    });

    it('should show animate parameter drawer when animate is checked', async () => {
      render(
        <ProcessingOptionsPanel
          photo={mockPhoto}
          availableCredits={mockCredits}
          onOptionsChange={jest.fn()}
          onProcess={jest.fn()}
          isProcessing={false}
        />
      );

      const animateCheckbox = screen.getByRole('checkbox', { name: /animate/i });
      fireEvent.click(animateCheckbox);

      await waitFor(() => {
        expect(screen.getByTestId('parameter-drawer-animate')).toBeInTheDocument();
      });
    });

    it('should not show colourize as a top-level option', () => {
      render(
        <ProcessingOptionsPanel
          photo={mockPhoto}
          availableCredits={mockCredits}
          onOptionsChange={jest.fn()}
          onProcess={jest.fn()}
          isProcessing={false}
        />
      );

      // Colourize should NOT appear as a checkbox at the top level
      const checkboxes = screen.getAllByRole('checkbox');
      const colourizeCheckbox = checkboxes.find(cb => 
        cb.getAttribute('name')?.toLowerCase().includes('colourize')
      );
      expect(colourizeCheckbox).toBeUndefined();
    });
  });

  describe('Credit Calculation', () => {
    it('should show cost breakdown when options are selected', async () => {
      render(
        <ProcessingOptionsPanel
          photo={mockPhoto}
          availableCredits={mockCredits}
          onOptionsChange={jest.fn()}
          onProcess={jest.fn()}
          isProcessing={false}
        />
      );

      const restoreCheckbox = screen.getByRole('checkbox', { name: /restore/i });
      fireEvent.click(restoreCheckbox);

      await waitFor(() => {
        // Look for the process button with credits shown
        const processButton = screen.queryByText(/Process Photo \(2 credits\)/i);
        expect(processButton).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should calculate restore cost correctly (2 credits)', async () => {
      render(
        <ProcessingOptionsPanel
          photo={mockPhoto}
          availableCredits={mockCredits}
          onOptionsChange={jest.fn()}
          onProcess={jest.fn()}
          isProcessing={false}
        />
      );

      const restoreCheckbox = screen.getByRole('checkbox', { name: /restore/i });
      fireEvent.click(restoreCheckbox);

      await waitFor(() => {
        const processButton = screen.getByText(/Process Photo \(2 credits\)/i);
        expect(processButton).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should show remaining credits after processing', async () => {
      render(
        <ProcessingOptionsPanel
          photo={mockPhoto}
          availableCredits={mockCredits}
          onOptionsChange={jest.fn()}
          onProcess={jest.fn()}
          isProcessing={false}
        />
      );

      const restoreCheckbox = screen.getByRole('checkbox', { name: /restore/i });
      fireEvent.click(restoreCheckbox);

      await waitFor(() => {
        expect(screen.getByText(/Available: 100 credits/)).toBeInTheDocument();
        expect(screen.getByText(/Remaining after: 98 credits/)).toBeInTheDocument();
      });
    });

    it('should show dynamic animate cost range (10-50 credits)', () => {
      render(
        <ProcessingOptionsPanel
          photo={mockPhoto}
          availableCredits={mockCredits}
          onOptionsChange={jest.fn()}
          onProcess={jest.fn()}
          isProcessing={false}
        />
      );

      expect(screen.getByText(/10-50 credits/)).toBeInTheDocument();
    });

    it('should not show combined discount (removed per requirements)', async () => {
      render(
        <ProcessingOptionsPanel
          photo={mockPhoto}
          availableCredits={mockCredits}
          onOptionsChange={jest.fn()}
          onProcess={jest.fn()}
          isProcessing={false}
        />
      );

      const restoreCheckbox = screen.getByRole('checkbox', { name: /restore/i });
      fireEvent.click(restoreCheckbox);

      await waitFor(() => {
        expect(screen.queryByText(/Combined Discount/)).not.toBeInTheDocument();
        expect(screen.queryByText(/discount/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Process Button', () => {
    it('should be disabled when no options selected', () => {
      render(
        <ProcessingOptionsPanel
          photo={mockPhoto}
          availableCredits={mockCredits}
          onOptionsChange={jest.fn()}
          onProcess={jest.fn()}
          isProcessing={false}
        />
      );

      const processButton = screen.getByText(/Process Photo/i).closest('button');
      expect(processButton).toBeDisabled();
    });

    it('should be enabled when options selected and credits available', async () => {
      render(
        <ProcessingOptionsPanel
          photo={mockPhoto}
          availableCredits={mockCredits}
          onOptionsChange={jest.fn()}
          onProcess={jest.fn()}
          isProcessing={false}
        />
      );

      const restoreCheckbox = screen.getByRole('checkbox', { name: /restore/i });
      fireEvent.click(restoreCheckbox);

      await waitFor(() => {
        const processButton = screen.getByText(/Process Photo \(2 credits\)/i).closest('button');
        expect(processButton).not.toBeDisabled();
      });
    });

    it('should call onProcess with correct options', async () => {
      const mockOnProcess = jest.fn();
      render(
        <ProcessingOptionsPanel
          photo={mockPhoto}
          availableCredits={mockCredits}
          onOptionsChange={jest.fn()}
          onProcess={mockOnProcess}
          isProcessing={false}
        />
      );

      const restoreCheckbox = screen.getByRole('checkbox', { name: /restore/i });
      fireEvent.click(restoreCheckbox);

      await waitFor(() => {
        const processButton = screen.getByText(/Process Photo/i).closest('button');
        expect(processButton).not.toBeDisabled();
      });

      const processButton = screen.getByText(/Process Photo/i).closest('button');
      fireEvent.click(processButton!);
      expect(mockOnProcess).toHaveBeenCalled();
    });

    it('should show processing state', () => {
      render(
        <ProcessingOptionsPanel
          photo={mockPhoto}
          availableCredits={mockCredits}
          onOptionsChange={jest.fn()}
          onProcess={jest.fn()}
          isProcessing={true}
        />
      );

      // Look for button containing "Processing..."
      const buttons = screen.getAllByRole('button');
      const processButton = buttons.find(btn => btn.textContent?.includes('Processing...'));
      expect(processButton).toBeDefined();
      expect(processButton).toBeDisabled();
    });
  });

  describe('Insufficient Credits', () => {
    it('should disable process button when insufficient credits', async () => {
      const lowCredits: CreditBalance = {
        ...mockCredits,
        totalCredits: 1 // Not enough for restore (2 credits)
      };

      render(
        <ProcessingOptionsPanel
          photo={mockPhoto}
          availableCredits={lowCredits}
          onOptionsChange={jest.fn()}
          onProcess={jest.fn()}
          isProcessing={false}
        />
      );

      const restoreCheckbox = screen.getByRole('checkbox', { name: /restore/i });
      fireEvent.click(restoreCheckbox);

      await waitFor(() => {
        const processButton = screen.getByText(/Process Photo/i).closest('button');
        expect(processButton).toBeDisabled();
      });
    });

    it('should show insufficient credits warning', async () => {
      const lowCredits: CreditBalance = {
        ...mockCredits,
        totalCredits: 1
      };

      render(
        <ProcessingOptionsPanel
          photo={mockPhoto}
          availableCredits={lowCredits}
          onOptionsChange={jest.fn()}
          onProcess={jest.fn()}
          isProcessing={false}
        />
      );

      const restoreCheckbox = screen.getByRole('checkbox', { name: /restore/i });
      fireEvent.click(restoreCheckbox);

      await waitFor(() => {
        expect(screen.getByText(/Insufficient credits/i)).toBeInTheDocument();
        expect(screen.getByText(/You need 2 credits but only have 1/i)).toBeInTheDocument();
      });
    });
  });

  describe('Disabled Options', () => {
    it('should disable Bring Together option (Post-MVP)', () => {
      render(
        <ProcessingOptionsPanel
          photo={mockPhoto}
          availableCredits={mockCredits}
          onOptionsChange={jest.fn()}
          onProcess={jest.fn()}
          isProcessing={false}
        />
      );

      const bringTogetherCheckbox = screen.getByRole('checkbox', { name: /bring together/i });
      expect(bringTogetherCheckbox).toBeDisabled();
      expect(screen.getByText(/Coming soon - Combine multiple photos/)).toBeInTheDocument();
    });
  });

  describe('Integration with Parameters', () => {
    it('should include parameters in options state', async () => {
      const mockOnChange = jest.fn();
      render(
        <ProcessingOptionsPanel
          photo={mockPhoto}
          availableCredits={mockCredits}
          onOptionsChange={mockOnChange}
          onProcess={jest.fn()}
          isProcessing={false}
        />
      );

      const restoreCheckbox = screen.getByRole('checkbox', { name: /restore/i });
      fireEvent.click(restoreCheckbox);

      await waitFor(() => {
        const options = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
        expect(options.parameters).toBeDefined();
        expect(options.parameters?.restore).toBeDefined();
        expect(options.parameters?.restore?.colourize).toBe(false);
        expect(options.parameters?.restore?.denoiseLevel).toBe(0.7);
      });
    });

    it('should have default denoise level of 0.7', async () => {
      const mockOnChange = jest.fn();
      render(
        <ProcessingOptionsPanel
          photo={mockPhoto}
          availableCredits={mockCredits}
          onOptionsChange={mockOnChange}
          onProcess={jest.fn()}
          isProcessing={false}
        />
      );

      const restoreCheckbox = screen.getByRole('checkbox', { name: /restore/i });
      fireEvent.click(restoreCheckbox);

      await waitFor(() => {
        const options = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
        expect(options.parameters?.restore?.denoiseLevel).toBe(0.7);
      });
    });

    it('should have default video duration of 15 seconds', async () => {
      const mockOnChange = jest.fn();
      render(
        <ProcessingOptionsPanel
          photo={mockPhoto}
          availableCredits={mockCredits}
          onOptionsChange={mockOnChange}
          onProcess={jest.fn()}
          isProcessing={false}
        />
      );

      const animateCheckbox = screen.getByRole('checkbox', { name: /animate/i });
      fireEvent.click(animateCheckbox);

      await waitFor(() => {
        const options = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
        expect(options.parameters?.animate?.videoDuration).toBe(15);
      });
    });
  });
});

