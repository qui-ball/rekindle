/**
 * CornerGuideOverlay Integration Tests
 * 
 * Tests the integration between CornerGuideOverlay and GuideContentDetector
 * including real-time detection, smart hiding, and visual feedback.
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { CornerGuideOverlay } from '../CornerGuideOverlay';
import { guideContentDetector } from '../../../services/GuideContentDetector';

// Mock the GuideContentDetector
jest.mock('../../../services/GuideContentDetector', () => ({
  guideContentDetector: {
    initialize: jest.fn(),
    isReady: jest.fn(),
    startRealTimeDetection: jest.fn(),
    stopRealTimeDetection: jest.fn(),
    getDetectionState: jest.fn(),
    shouldHideGuide: jest.fn()
  }
}));

const mockGuideContentDetector = guideContentDetector as jest.Mocked<typeof guideContentDetector>;

describe('CornerGuideOverlay Integration', () => {
  let mockVideoElement: HTMLVideoElement;
  let mockOnDetectionResult: jest.Mock;
  let mockOnGuidePositionChange: jest.Mock;

  beforeEach(() => {
    // Mock video element
    mockVideoElement = {
      videoWidth: 1920,
      videoHeight: 1080,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    } as Partial<HTMLVideoElement>;

    // Mock callbacks
    mockOnDetectionResult = jest.fn();
    mockOnGuidePositionChange = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
    
    // Default mock implementations
    mockGuideContentDetector.isReady.mockReturnValue(true);
    mockGuideContentDetector.getDetectionState.mockReturnValue({
      portrait: { isDetected: false, confidence: 0, lastDetection: 0 },
      landscape: { isDetected: false, confidence: 0, lastDetection: 0 },
      activeOrientation: null,
      lastUpdate: Date.now()
    });
    mockGuideContentDetector.shouldHideGuide.mockReturnValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize guide content detector when visible', async () => {
      mockGuideContentDetector.initialize.mockResolvedValue(true);

      render(
        <CornerGuideOverlay
          isVisible={true}
          videoElement={mockVideoElement}
          onDetectionResult={mockOnDetectionResult}
          onGuidePositionChange={mockOnGuidePositionChange}
        />
      );

      await waitFor(() => {
        expect(mockGuideContentDetector.initialize).toHaveBeenCalled();
      });
    });

    it('should not initialize when not visible', () => {
      render(
        <CornerGuideOverlay
          isVisible={false}
          videoElement={mockVideoElement}
          onDetectionResult={mockOnDetectionResult}
          onGuidePositionChange={mockOnGuidePositionChange}
        />
      );

      expect(mockGuideContentDetector.initialize).not.toHaveBeenCalled();
    });
  });

  describe('Real-time Detection', () => {
    it('should start real-time detection when ready', async () => {
      mockGuideContentDetector.initialize.mockResolvedValue(true);
      mockGuideContentDetector.isReady.mockReturnValue(true);

      render(
        <CornerGuideOverlay
          isVisible={true}
          videoElement={mockVideoElement}
          onDetectionResult={mockOnDetectionResult}
          onGuidePositionChange={mockOnGuidePositionChange}
        />
      );

      await waitFor(() => {
        expect(mockGuideContentDetector.startRealTimeDetection).toHaveBeenCalledWith(
          mockVideoElement,
          expect.objectContaining({
            topLeft: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
            topRight: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
            bottomLeft: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
            bottomRight: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
          }),
          expect.objectContaining({
            topLeft: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
            topRight: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
            bottomLeft: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
            bottomRight: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
          }),
          expect.any(Function)
        );
      });
    });

    it('should stop real-time detection on unmount', async () => {
      mockGuideContentDetector.initialize.mockResolvedValue(true);
      mockGuideContentDetector.isReady.mockReturnValue(true);

      const { unmount } = render(
        <CornerGuideOverlay
          isVisible={true}
          videoElement={mockVideoElement}
          onDetectionResult={mockOnDetectionResult}
          onGuidePositionChange={mockOnGuidePositionChange}
        />
      );

      await waitFor(() => {
        expect(mockGuideContentDetector.startRealTimeDetection).toHaveBeenCalled();
      });

      unmount();

      expect(mockGuideContentDetector.stopRealTimeDetection).toHaveBeenCalled();
    });
  });

  describe('Smart Hiding Logic', () => {
    it('should hide portrait guide when landscape is detected', async () => {
      mockGuideContentDetector.initialize.mockResolvedValue(true);
      mockGuideContentDetector.isReady.mockReturnValue(true);
      mockGuideContentDetector.shouldHideGuide.mockImplementation((orientation) => orientation === 'portrait');
      mockGuideContentDetector.getDetectionState.mockReturnValue({
        portrait: { isDetected: false, confidence: 0.2, lastDetection: Date.now() },
        landscape: { isDetected: true, confidence: 0.9, lastDetection: Date.now() },
        activeOrientation: 'landscape',
        lastUpdate: Date.now()
      });

      render(
        <CornerGuideOverlay
          isVisible={true}
          videoElement={mockVideoElement}
          onDetectionResult={mockOnDetectionResult}
          onGuidePositionChange={mockOnGuidePositionChange}
        />
      );

      await waitFor(() => {
        // Portrait guides should be hidden
        const portraitGuides = screen.queryByText(/Portrait/);
        expect(portraitGuides).not.toBeInTheDocument();
      });
    });

    it('should hide landscape guide when portrait is detected', async () => {
      mockGuideContentDetector.initialize.mockResolvedValue(true);
      mockGuideContentDetector.isReady.mockReturnValue(true);
      mockGuideContentDetector.shouldHideGuide.mockImplementation((orientation) => orientation === 'landscape');
      mockGuideContentDetector.getDetectionState.mockReturnValue({
        portrait: { isDetected: true, confidence: 0.9, lastDetection: Date.now() },
        landscape: { isDetected: false, confidence: 0.2, lastDetection: Date.now() },
        activeOrientation: 'portrait',
        lastUpdate: Date.now()
      });

      render(
        <CornerGuideOverlay
          isVisible={true}
          videoElement={mockVideoElement}
          onDetectionResult={mockOnDetectionResult}
          onGuidePositionChange={mockOnGuidePositionChange}
        />
      );

      await waitFor(() => {
        // Landscape guides should be hidden
        const landscapeGuides = screen.queryByText(/Landscape/);
        expect(landscapeGuides).not.toBeInTheDocument();
      });
    });
  });

  describe('Visual Feedback', () => {
    it('should show detection status indicators', async () => {
      mockGuideContentDetector.initialize.mockResolvedValue(true);
      mockGuideContentDetector.isReady.mockReturnValue(true);
      mockGuideContentDetector.getDetectionState.mockReturnValue({
        portrait: { isDetected: true, confidence: 0.8, lastDetection: Date.now() },
        landscape: { isDetected: false, confidence: 0.3, lastDetection: Date.now() },
        activeOrientation: 'portrait',
        lastUpdate: Date.now()
      });

      // Mock the detection result callback
      let detectionCallback: ((result: GuideDetectionResult) => void) | null = null;
      mockGuideContentDetector.startRealTimeDetection.mockImplementation((video, portraitCorners, landscapeCorners, callback) => {
        detectionCallback = callback;
      });

      render(
        <CornerGuideOverlay
          isVisible={true}
          videoElement={mockVideoElement}
          onDetectionResult={mockOnDetectionResult}
          onGuidePositionChange={mockOnGuidePositionChange}
        />
      );

      // Simulate a detection result
      await waitFor(() => {
        expect(detectionCallback).toBeDefined();
      });

      act(() => {
        if (detectionCallback) {
          detectionCallback({
            orientation: 'portrait',
            confidence: 0.8,
            detectedCorners: null,
            isDetected: true,
            detectionSource: 'jscanify',
            metrics: { areaRatio: 0.7, edgeRatio: 0.8, minDistance: 10, processingTime: 100 }
          });
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/Portrait: 80%/)).toBeInTheDocument();
      });
    });

    it('should show detection processing indicator', async () => {
      mockGuideContentDetector.initialize.mockResolvedValue(true);
      mockGuideContentDetector.isReady.mockReturnValue(true);
      mockGuideContentDetector.getDetectionState.mockReturnValue({
        portrait: { isDetected: false, confidence: 0, lastDetection: 0 },
        landscape: { isDetected: false, confidence: 0, lastDetection: 0 },
        activeOrientation: null,
        lastUpdate: Date.now()
      });

      // Mock detection result with isDetected: true
      const mockDetectionResult = {
        orientation: 'portrait' as const,
        confidence: 0.8,
        detectedCorners: null,
        isDetected: true,
        detectionSource: 'jscanify' as const,
        metrics: {
          areaRatio: 0.7,
          edgeRatio: 0.8,
          minDistance: 10,
          processingTime: 50
        }
      };

      // Simulate detection callback
      let detectionCallback: (result: GuideDetectionResult) => void;
      mockGuideContentDetector.startRealTimeDetection.mockImplementation((video, portraitCorners, landscapeCorners, callback) => {
        detectionCallback = callback;
      });

      render(
        <CornerGuideOverlay
          isVisible={true}
          videoElement={mockVideoElement}
          onDetectionResult={mockOnDetectionResult}
          onGuidePositionChange={mockOnGuidePositionChange}
        />
      );

      await waitFor(() => {
        expect(mockGuideContentDetector.startRealTimeDetection).toHaveBeenCalled();
      });

      // Simulate detection result
      act(() => {
        if (detectionCallback) {
          detectionCallback(mockDetectionResult);
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/🔍 Detecting.../)).toBeInTheDocument();
      });
    });
  });

  describe('Detection Result Callback', () => {
    it('should call onDetectionResult when detection occurs', async () => {
      mockGuideContentDetector.initialize.mockResolvedValue(true);
      mockGuideContentDetector.isReady.mockReturnValue(true);

      const mockDetectionResult = {
        orientation: 'portrait' as const,
        confidence: 0.8,
        detectedCorners: {
          topLeft: { x: 100, y: 100 },
          topRight: { x: 300, y: 100 },
          bottomLeft: { x: 100, y: 400 },
          bottomRight: { x: 300, y: 400 }
        },
        isDetected: true,
        detectionSource: 'jscanify' as const,
        metrics: {
          areaRatio: 0.7,
          edgeRatio: 0.8,
          minDistance: 10,
          processingTime: 50
        }
      };

      // Simulate detection callback
      let detectionCallback: (result: GuideDetectionResult) => void;
      mockGuideContentDetector.startRealTimeDetection.mockImplementation((video, portraitCorners, landscapeCorners, callback) => {
        detectionCallback = callback;
      });

      render(
        <CornerGuideOverlay
          isVisible={true}
          videoElement={mockVideoElement}
          onDetectionResult={mockOnDetectionResult}
          onGuidePositionChange={mockOnGuidePositionChange}
        />
      );

      await waitFor(() => {
        expect(mockGuideContentDetector.startRealTimeDetection).toHaveBeenCalled();
      });

      // Simulate detection result
      act(() => {
        if (detectionCallback) {
          detectionCallback(mockDetectionResult);
        }
      });

      await waitFor(() => {
        expect(mockOnDetectionResult).toHaveBeenCalledWith(mockDetectionResult);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      mockGuideContentDetector.initialize.mockResolvedValue(true);
      mockGuideContentDetector.isReady.mockReturnValue(true);

      render(
        <CornerGuideOverlay
          isVisible={true}
          videoElement={mockVideoElement}
          onDetectionResult={mockOnDetectionResult}
          onGuidePositionChange={mockOnGuidePositionChange}
        />
      );

      await waitFor(() => {
        const overlay = screen.getByRole('img');
        expect(overlay).toHaveAttribute('aria-label', 'Photo positioning guides for both portrait and landscape orientations');
      });
    });

    it('should support high contrast mode', async () => {
      // Mock high contrast preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      mockGuideContentDetector.initialize.mockResolvedValue(true);
      mockGuideContentDetector.isReady.mockReturnValue(true);

      render(
        <CornerGuideOverlay
          isVisible={true}
          videoElement={mockVideoElement}
          onDetectionResult={mockOnDetectionResult}
          onGuidePositionChange={mockOnGuidePositionChange}
        />
      );

      await waitFor(() => {
        // Should render without errors in high contrast mode
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle detector initialization failure', async () => {
      mockGuideContentDetector.initialize.mockRejectedValue(new Error('Initialization failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <CornerGuideOverlay
          isVisible={true}
          videoElement={mockVideoElement}
          onDetectionResult={mockOnDetectionResult}
          onGuidePositionChange={mockOnGuidePositionChange}
        />
      );

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to initialize guide content detector:',
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });

    it('should handle missing video element gracefully', () => {
      render(
        <CornerGuideOverlay
          isVisible={true}
          onDetectionResult={mockOnDetectionResult}
          onGuidePositionChange={mockOnGuidePositionChange}
        />
      );

      // Should render without errors
      expect(screen.getByRole('img')).toBeInTheDocument();
    });
  });
});
