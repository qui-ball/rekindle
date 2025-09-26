/**
 * CameraCaptureExample Component
 * 
 * Example usage of the CameraCaptureModal component.
 * Shows how to integrate the full-screen camera modal into your app.
 */

import React, { useState } from 'react';
import { CameraCaptureModal } from './CameraCaptureModal';

export const CameraCaptureExample: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOpenCamera = () => {
    setIsModalOpen(true);
    setError(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleCapture = (imageData: string) => {
    setCapturedImage(imageData);
    console.log('Captured image:', imageData.substring(0, 50) + '...');
  };

  const handleError = (cameraError: any) => {
    setError(cameraError.message);
    console.error('Camera error:', cameraError);
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4">Camera Capture Demo</h2>
      
      {/* Open Camera Button */}
      <button
        onClick={handleOpenCamera}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg mb-4"
      >
        📷 Open Camera
      </button>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Captured Image Display */}
      {capturedImage && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Captured Photo:</h3>
          <img
            src={capturedImage}
            alt="Captured"
            className="w-full rounded-lg border border-gray-300"
          />
          <button
            onClick={() => setCapturedImage(null)}
            className="mt-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Clear Image
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="text-sm text-gray-600">
        <h4 className="font-medium mb-2">Features:</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>Separate page camera interface (not full-screen)</li>
          <li>Centered capture area with larger view</li>
          <li>Real-time lighting quality detection</li>
          <li>Real-time blur/focus detection</li>
          <li>Preview state after capture with accept/reject</li>
          <li>Visual feedback with colored capture button</li>
          <li>Escape key to close</li>
          <li>Optimized for mobile photo capture</li>
        </ul>
      </div>

      {/* Camera Modal */}
      <CameraCaptureModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onCapture={handleCapture}
        onError={handleError}
        facingMode="environment"
        closeOnEscape={true}
      />
    </div>
  );
};

export default CameraCaptureExample;