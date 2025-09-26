'use client';

import React, { useState } from 'react';
import { CameraCaptureModal, LandscapeTest } from '../../components/PhotoUpload';

export default function CameraPage() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCapture = (imageData: string) => {
    console.log('Photo captured!', imageData.substring(0, 50) + '...');
    setCapturedImage(imageData);
    setError(null);
    setIsModalOpen(false);
  };

  const handleError = (cameraError: { code: string; message: string }) => {
    console.error('Camera error:', cameraError);
    setError(`${cameraError.code}: ${cameraError.message}`);
    setCapturedImage(null);
  };

  const resetTest = () => {
    setCapturedImage(null);
    setError(null);
  };

  const openCamera = () => {
    setIsModalOpen(true);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Camera Upload
        </h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">
            Test Instructions:
          </h2>
          <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
            <li>Allow camera permission when prompted</li>
            <li>Position a physical photo within the corner guides</li>
            <li>Tap the red capture button to take a photo</li>
            <li>The captured image will appear below</li>
          </ul>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">
            Camera Modal Test:
          </h2>
          
          <button
            onClick={openCamera}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg mb-4"
          >
            📷 Open Camera Modal
          </button>
          
          <p className="text-sm text-gray-600">
            Click the button above to open the camera modal. Rotate your device to test landscape mode.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">
            Landscape Mode Test:
          </h2>
          <LandscapeTest />
        </div>

        {capturedImage && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-700">
                Captured Image:
              </h2>
              <button
                onClick={resetTest}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Reset Test
              </button>
            </div>
            
            <div className="border rounded-lg overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capturedImage}
                alt="Captured photo"
                className="w-full h-auto"
              />
            </div>
            
            <div className="mt-4 p-3 bg-gray-50 rounded text-sm text-gray-600">
              <strong>Image Data:</strong> {capturedImage.substring(0, 100)}...
            </div>
          </div>
        )}

        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">
            Testing Checklist:
          </h2>
          <div className="space-y-2">
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              <span>Camera permission requested and granted</span>
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              <span>Back camera is active (for physical photos)</span>
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              <span>Modal opens in full-screen overlay</span>
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              <span>Landscape mode works on mobile (rotate device)</span>
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              <span>Capture button is enabled and responsive</span>
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              <span>Photo capture works and displays result</span>
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              <span>Error handling works (try denying permission)</span>
            </label>
          </div>
        </div>

        {/* Camera Modal */}
        <CameraCaptureModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onCapture={handleCapture}
          onError={handleError}
          facingMode="environment"
          closeOnEscape={true}
        />
      </div>
    </div>
  );
}