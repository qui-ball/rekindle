// Re-export upload types for component use
export * from '../../types/upload';

// Export modal-specific types
export interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageData: string) => void;
  onError: (error: { code: string; message: string; name: string }) => void;
  closeOnEscape?: boolean;
  closeOnOutsideClick?: boolean;
  facingMode?: 'user' | 'environment';
  // aspectRatio removed for native camera behavior
}