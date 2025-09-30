// OpenCV.js async loader service for JScanify integration

export interface OpenCVLoadStatus {
  status: 'loading' | 'ready' | 'error';
  progress?: number;
  error?: string;
}

export type OpenCVLoadCallback = (status: OpenCVLoadStatus) => void;

export class OpenCVLoader {
  private isLoaded = false;
  private isLoading = false;
  private loadPromise: Promise<void> | null = null;
  private callbacks: OpenCVLoadCallback[] = [];

  /**
   * Load OpenCV.js from CDN with progress tracking
   */
  async loadOpenCV(onProgress?: OpenCVLoadCallback): Promise<void> {
    if (this.isLoaded) {
      onProgress?.({ status: 'ready' });
      return;
    }

    if (this.isLoading && this.loadPromise) {
      if (onProgress) {
        this.callbacks.push(onProgress);
      }
      return this.loadPromise;
    }

    this.isLoading = true;
    if (onProgress) {
      this.callbacks.push(onProgress);
    }

    this.notifyCallbacks({ status: 'loading', progress: 0 });

    this.loadPromise = new Promise<void>((resolve, reject) => {
      try {
        // Check if we're in browser environment
        if (typeof window === 'undefined' || typeof document === 'undefined') {
          reject(new Error('Not in browser environment'));
          return;
        }

        // Check if OpenCV is already loaded
        if (window.cv && window.cv.Mat) {
          this.isLoaded = true;
          this.isLoading = false;
          this.notifyCallbacks({ status: 'ready' });
          resolve();
          return;
        }

        // Create script element
        const script = document.createElement('script');
        script.src = 'https://docs.opencv.org/4.7.0/opencv.js';
        script.async = true;
        script.defer = true;

        // Track loading progress (approximate)
        let progressInterval: NodeJS.Timeout;
        let progress = 0;

        const startProgressTracking = () => {
          progressInterval = setInterval(() => {
            progress = Math.min(progress + 10, 90);
            this.notifyCallbacks({ status: 'loading', progress });
          }, 200);
        };

        const stopProgressTracking = () => {
          if (progressInterval) {
            clearInterval(progressInterval);
          }
        };

        script.onload = () => {
          stopProgressTracking();
          this.notifyCallbacks({ status: 'loading', progress: 95 });

          // Wait for OpenCV to be ready
          const checkOpenCV = () => {
            if (typeof window !== 'undefined' && window.cv && window.cv.Mat) {
              this.isLoaded = true;
              this.isLoading = false;
              this.notifyCallbacks({ status: 'ready' });
              this.clearCallbacks();
              resolve();
            } else {
              setTimeout(checkOpenCV, 100);
            }
          };

          checkOpenCV();
        };

        script.onerror = (_error) => {
          stopProgressTracking();
          this.isLoading = false;
          const errorMessage = 'Failed to load OpenCV.js';
          this.notifyCallbacks({ status: 'error', error: errorMessage });
          this.clearCallbacks();
          reject(new Error(errorMessage));
        };

        // Start progress tracking and append script with error handling
        startProgressTracking();
        try {
          document.head.appendChild(script);
        } catch (appendError) {
          stopProgressTracking();
          this.isLoading = false;
          const errorMessage = `Failed to append OpenCV script: ${appendError instanceof Error ? appendError.message : 'Unknown error'}`;
          this.notifyCallbacks({ status: 'error', error: errorMessage });
          this.clearCallbacks();
          reject(new Error(errorMessage));
        }

        // Timeout after 30 seconds
        setTimeout(() => {
          if (!this.isLoaded) {
            stopProgressTracking();
            this.isLoading = false;
            const errorMessage = 'OpenCV.js loading timeout';
            this.notifyCallbacks({ status: 'error', error: errorMessage });
            this.clearCallbacks();
            reject(new Error(errorMessage));
          }
        }, 30000);

      } catch (error) {
        this.isLoading = false;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error loading OpenCV.js';
        this.notifyCallbacks({ status: 'error', error: errorMessage });
        this.clearCallbacks();
        reject(error);
      }
    });

    return this.loadPromise;
  }

  /**
   * Check if OpenCV.js is loaded and ready
   */
  isReady(): boolean {
    return this.isLoaded && typeof window !== 'undefined' && !!window.cv && !!window.cv.Mat;
  }

  /**
   * Get OpenCV object (only call after isReady() returns true)
   */
  getOpenCV(): typeof window.cv {
    if (!this.isReady()) {
      throw new Error('OpenCV.js is not loaded. Call loadOpenCV() first.');
    }
    return window.cv;
  }

  private notifyCallbacks(status: OpenCVLoadStatus) {
    this.callbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.warn('Error in OpenCV load callback:', error);
      }
    });
  }

  private clearCallbacks() {
    this.callbacks = [];
  }
}

// Export singleton instance
export const opencvLoader = new OpenCVLoader();

// React hook for OpenCV loading
export const useOpenCVLoader = () => {
  const [status, setStatus] = React.useState<OpenCVLoadStatus>({ status: 'loading' });

  React.useEffect(() => {
    if (opencvLoader.isReady()) {
      setStatus({ status: 'ready' });
      return;
    }

    opencvLoader.loadOpenCV(setStatus).catch((error) => {
      setStatus({ status: 'error', error: error.message });
    });
  }, []);

  return {
    ...status,
    loadOpenCV: opencvLoader.loadOpenCV.bind(opencvLoader),
    isReady: opencvLoader.isReady.bind(opencvLoader),
    getOpenCV: opencvLoader.getOpenCV.bind(opencvLoader),
  };
};

// Add React import for the hook
import React from 'react';