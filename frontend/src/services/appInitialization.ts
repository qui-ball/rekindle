// App initialization service with OpenCV.js preloading
import { opencvLoader, OpenCVLoadStatus } from './opencvLoader';

export interface AppInitializationState {
  status: 'loading' | 'ready' | 'fallback';
  progress: number;
  message: string;
  error?: string;
}

export type AppInitializationCallback = (state: AppInitializationState) => void;

export class AppInitializationService {
  private isInitialized = false;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;
  private callbacks: AppInitializationCallback[] = [];

  /**
   * Initialize the app with OpenCV.js preloading
   */
  async initialize(onProgress?: AppInitializationCallback): Promise<void> {
    if (this.isInitialized) {
      onProgress?.({ 
        status: 'ready', 
        progress: 100, 
        message: 'App ready' 
      });
      return;
    }

    if (this.isInitializing && this.initPromise) {
      if (onProgress) {
        this.callbacks.push(onProgress);
      }
      return this.initPromise;
    }

    this.isInitializing = true;
    if (onProgress) {
      this.callbacks.push(onProgress);
    }

    this.notifyCallbacks({
      status: 'loading',
      progress: 0,
      message: 'Preparing smart photo detection...'
    });

    this.initPromise = new Promise<void>((resolve) => {
      // Start OpenCV.js loading immediately in background
      try {
        // Start OpenCV.js loading
        opencvLoader.loadOpenCV((opencvStatus: OpenCVLoadStatus) => {
          this.handleOpenCVProgress(opencvStatus, resolve);
        }).catch((error) => {
          console.warn('OpenCV loading failed, using fallback mode:', error);
          this.handleFallbackMode(resolve);
        });

        // Set a timeout for graceful fallback
        setTimeout(() => {
          if (!this.isInitialized) {
            console.log('OpenCV loading timeout, switching to fallback mode');
            this.handleFallbackMode(resolve);
          }
        }, 15000); // 15 second timeout
      } catch (error) {
        console.warn('Initialization error, using fallback mode:', error);
        this.handleFallbackMode(resolve);
      }
    });

    return this.initPromise;
  }

  /**
   * Handle OpenCV loading progress
   */
  private handleOpenCVProgress(opencvStatus: OpenCVLoadStatus, resolve: () => void) {
    switch (opencvStatus.status) {
      case 'loading':
        this.notifyCallbacks({
          status: 'loading',
          progress: Math.min((opencvStatus.progress || 0) * 0.9, 90), // Reserve 10% for final setup
          message: opencvStatus.progress && opencvStatus.progress > 50 
            ? 'Loading smart detection engine...' 
            : 'Downloading smart detection engine...'
        });
        break;

      case 'ready':
        this.notifyCallbacks({
          status: 'loading',
          progress: 95,
          message: 'Finalizing setup...'
        });

        // Small delay to show completion message
        setTimeout(() => {
          this.isInitialized = true;
          this.isInitializing = false;
          this.notifyCallbacks({
            status: 'ready',
            progress: 100,
            message: 'Smart photo detection ready!'
          });
          this.clearCallbacks();
          resolve();
        }, 500);
        break;

      case 'error':
        console.warn('OpenCV loading failed:', opencvStatus.error);
        this.handleFallbackMode(resolve);
        break;
    }
  }

  /**
   * Handle fallback mode when OpenCV fails to load
   */
  private handleFallbackMode(resolve: () => void) {
    if (this.isInitialized) return; // Already resolved

    this.isInitialized = true;
    this.isInitializing = false;
    
    this.notifyCallbacks({
      status: 'fallback',
      progress: 100,
      message: 'App ready with basic cropping'
    });
    
    this.clearCallbacks();
    resolve();
  }

  /**
   * Check if app is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get current initialization status
   */
  getStatus(): 'loading' | 'ready' | 'fallback' {
    if (!this.isInitialized) return 'loading';
    return opencvLoader.isReady() ? 'ready' : 'fallback';
  }

  /**
   * Check if smart detection is available
   */
  hasSmartDetection(): boolean {
    return this.isInitialized && opencvLoader.isReady();
  }

  private notifyCallbacks(state: AppInitializationState) {
    this.callbacks.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.warn('Error in app initialization callback:', error);
      }
    });
  }

  private clearCallbacks() {
    this.callbacks = [];
  }
}

// Export singleton instance
export const appInitialization = new AppInitializationService();