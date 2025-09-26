/**
 * CameraCaptureModal Component
 * 
 * Modal wrapper for camera capture flow functionality.
 * Provides a page overlay (not full-screen) with camera capture and preview states.
 * 
 * Features:
 * - Page overlay modal (not full-screen)
 * - Centered camera capture area
 * - Preview state after capture
 * - Accept/reject captured photo
 * - Escape key to close
 * - Portal rendering for proper z-index layering
 */

import React from 'react';
import { CameraCaptureFlow } from './CameraCaptureFlow';
import { CameraCaptureProps } from './types';

interface CameraCaptureModalProps extends Omit<CameraCaptureProps, 'onCapture'> {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageData: string) => void;
  closeOnEscape?: boolean;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  onError,
  closeOnEscape = true,
  facingMode = 'environment',
  aspectRatio = 4/3
}) => {
  return (
    <CameraCaptureFlow
      isOpen={isOpen}
      onClose={onClose}
      onCapture={onCapture}
      onError={onError}
      closeOnEscape={closeOnEscape}
      facingMode={facingMode}
      aspectRatio={aspectRatio}
    />
  );
};

export default CameraCaptureModal;