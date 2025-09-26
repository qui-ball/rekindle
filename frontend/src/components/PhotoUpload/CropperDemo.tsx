/**
 * CropperDemo Component
 * 
 * Simple demo component to test the QuadrilateralCropper functionality
 */

import React, { useState } from 'react';
import { QuadrilateralCropper } from './QuadrilateralCropper';
import { CropArea, CropAreaPixels } from './types';

export const CropperDemo: React.FC = () => {
  const [showCropper, setShowCropper] = useState(false);
  const [croppedResult, setCroppedResult] = useState<string | null>(null);

  // Sample image data (1x1 pixel base64 image for demo)
  const sampleImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA==';

  const handleCropComplete = (croppedArea: CropArea, croppedAreaPixels: CropAreaPixels) => {
    console.log('Crop completed:', { croppedArea, croppedAreaPixels });
    
    // In a real app, you would use the crop coordinates to actually crop the image
    // For demo purposes, we'll just show the coordinates
    setCroppedResult(`Cropped area: ${JSON.stringify(croppedAreaPixels, null, 2)}`);
    setShowCropper(false);
  };

  const handleCancel = () => {
    setShowCropper(false);
  };

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">QuadrilateralCropper Demo</h1>
        
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Features Tested:</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>✅ Initial cropping area positioned correctly (centered, 80% coverage)</li>
            <li>✅ Mobile touch support for dragging corner handles</li>
            <li>✅ Proper overlay rendering within quadrilateral bounds</li>
            <li>✅ Aspect ratio preservation</li>
            <li>✅ Full-screen cropping interface</li>
            <li>✅ Keyboard shortcuts (Escape to cancel, Enter to accept)</li>
          </ul>
        </div>

        <div className="text-center mb-6">
          <button
            onClick={() => setShowCropper(true)}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200"
          >
            Open Cropper Demo
          </button>
        </div>

        {croppedResult && (
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <h3 className="font-semibold text-green-800 mb-2">Crop Result:</h3>
            <pre className="text-sm text-green-700 whitespace-pre-wrap">{croppedResult}</pre>
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">Instructions:</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Click "Open Cropper Demo" to test the cropping interface</li>
            <li>• Drag the blue corner handles to adjust the crop area</li>
            <li>• On mobile devices, use touch to drag the handles</li>
            <li>• Press Escape to cancel or Enter to accept</li>
            <li>• Click "Accept Crop" button to complete cropping</li>
          </ul>
        </div>
      </div>

      {showCropper && (
        <QuadrilateralCropper
          image={sampleImage}
          onCropComplete={handleCropComplete}
          onCancel={handleCancel}
          isFullScreen={true}
        />
      )}
    </div>
  );
};

export default CropperDemo;