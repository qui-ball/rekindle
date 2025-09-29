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
  aspectRatio?: number; // Default: 4/3 (dynamic: 3/4 mobile portrait, 4/3 mobile landscape/desktop)
}