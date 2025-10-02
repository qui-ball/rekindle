/**
 * Test component to verify JScanify integration with QuadrilateralCropper
 * This component provides mock JScanify corner points for testing
 */

import React, { useState } from 'react';
import { QuadrilateralCropper } from './QuadrilateralCropper';
import type { CornerPoints } from '../../types/jscanify';

export const TestJScanifyIntegration: React.FC = () => {
  const [testImage] = useState('/api/placeholder/800/600'); // Use a placeholder image
  const [mockCornerPoints, setMockCornerPoints] = useState<CornerPoints | null>(null);
  const [confidence, setConfidence] = useState<number | undefined>(undefined);

  // Mock JScanify corner points for testing
  const generateMockCornerPoints = () => {
    const mockPoints: CornerPoints = {
      topLeftCorner: { x: 100, y: 80 },
      topRightCorner: { x: 700, y: 80 },
      bottomLeftCorner: { x: 100, y: 520 },
      bottomRightCorner: { x: 700, y: 520 }
    };
    setMockCornerPoints(mockPoints);
    setConfidence(0.85);
  };

  const clearMockData = () => {
    setMockCornerPoints(null);
    setConfidence(undefined);
  };

  const handleCropComplete = (croppedArea: unknown, croppedAreaPixels: unknown) => {
    console.log('Crop completed:', { croppedArea, croppedAreaPixels });
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">JScanify Integration Test</h2>
      
      <div className="mb-4 space-x-2">
        <button
          onClick={generateMockCornerPoints}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Simulate JScanify Detection
        </button>
        <button
          onClick={clearMockData}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Clear Mock Data
        </button>
      </div>

      <div className="mb-4">
        <p><strong>Status:</strong> {mockCornerPoints ? 'JScanify Active' : 'No Detection'}</p>
        <p><strong>Confidence:</strong> {confidence ? `${Math.round(confidence * 100)}%` : 'N/A'}</p>
      </div>

      <div className="border-2 border-gray-300 rounded-lg overflow-hidden" style={{ height: '600px' }}>
        <QuadrilateralCropper
          image={testImage}
          onCropComplete={handleCropComplete}
          onCancel={() => console.log('Crop cancelled')}
          jscanifyCornerPoints={mockCornerPoints || undefined}
          detectionConfidence={confidence}
          isFullScreen={false}
          alignTop={false}
        />
      </div>
    </div>
  );
};
