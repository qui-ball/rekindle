'use client';

import { CameraCaptureFlow } from '@/components/PhotoUpload/CameraCaptureFlow';
import { SimpleCameraTest } from '@/components/PhotoUpload/SimpleCameraTest';
import Link from 'next/link';
import { useState } from 'react';

export default function NativeCameraTestPage() {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = (imageData: string) => {
    setCapturedImage(imageData);
    setIsCameraOpen(false);
    setError(null);
    
    // Log image quality info
    const img = new Image();
    img.onload = () => {
      console.log('Captured image resolution:', img.naturalWidth, 'x', img.naturalHeight);
      console.log('Image data size:', Math.round(imageData.length / 1024), 'KB');
    };
    img.src = imageData;
  };

  const handleError = (cameraError: { code: string; message: string; name: string }) => {
    setError(`Camera Error: ${cameraError.message}`);
    console.error('Camera error:', cameraError);
  };

  const handleClose = () => {
    setIsCameraOpen(false);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link 
            href="/" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
        
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Native PWA Camera Test
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Test the integrated native PWA camera implementation with maximum device resolution and native app layout behavior.
          </p>
        </div>

        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h2 className="text-lg font-semibold text-blue-800 mb-2">What to Test:</h2>
            <ul className="text-blue-700 space-y-1">
              <li>• Camera should fill entire screen (no black bars)</li>
              <li>• Portrait mode: controls at bottom like native camera</li>
              <li>• Landscape mode: controls on right side like native camera</li>
              <li>• PWA mode detection and optimization</li>
              <li>• Check console for actual resolution captured</li>
              <li>• Compare image quality with your native camera app</li>
            </ul>
          </div>
          
          <SimpleCameraTest />
          
          <div className="mt-8 pt-8 border-t">
            <h2 className="text-xl font-semibold mb-4">Integrated Native PWA Camera Test</h2>
            
            <div className="space-y-4">
              <button
                onClick={() => setIsCameraOpen(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Test Native PWA Camera
              </button>

              {error && (
                <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                  {error}
                </div>
              )}

              {capturedImage && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Captured Image:</h3>
                  <img 
                    src={capturedImage} 
                    alt="Captured" 
                    className="max-w-full h-auto border rounded-lg shadow-lg"
                  />
                  <div className="text-sm text-gray-600">
                    <p>Image size: {Math.round(capturedImage.length / 1024)} KB</p>
                    <p>Check browser console for resolution details</p>
                  </div>
                </div>
              )}
            </div>

            <CameraCaptureFlow
              isOpen={isCameraOpen}
              onClose={handleClose}
              onCapture={handleCapture}
              onError={handleError}
            />
          </div>
        </div>
      </div>
    </main>
  );
}