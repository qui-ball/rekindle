/**
 * LandscapeTest Component
 * 
 * Simple test component to debug landscape mode detection
 */

import React, { useState, useEffect, useCallback } from 'react';

export const LandscapeTest: React.FC = () => {
  const [isLandscape, setIsLandscape] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const handleOrientationChange = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isMobile = width <= 768;
    const isCurrentlyLandscape = width > height;
    
    setDimensions({ width, height });
    setIsLandscape(isMobile && isCurrentlyLandscape);
    
    console.log('Orientation change:', {
      width,
      height,
      isMobile,
      isCurrentlyLandscape,
      finalIsLandscape: isMobile && isCurrentlyLandscape
    });
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Initial check
    handleOrientationChange();
    
    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [handleOrientationChange]);

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <h2 className="text-xl font-bold mb-4">Landscape Mode Test</h2>
      
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <h3 className="font-semibold mb-2">Current State:</h3>
        <p>Width: {dimensions.width}px</p>
        <p>Height: {dimensions.height}px</p>
        <p>Is Mobile: {dimensions.width <= 768 ? 'Yes' : 'No'}</p>
        <p>Is Landscape: {isLandscape ? 'Yes' : 'No'}</p>
      </div>

      <div className={`p-4 rounded-lg transition-all duration-300 ${
        isLandscape ? 'bg-green-200' : 'bg-blue-200'
      }`}>
        <h3 className="font-semibold mb-2">
          {isLandscape ? 'LANDSCAPE MODE' : 'PORTRAIT MODE'}
        </h3>
        
        <div className={`flex ${isLandscape ? 'flex-row' : 'flex-col'} gap-4`}>
          <div className={`${isLandscape ? 'w-20' : 'w-full'} bg-gray-800 text-white p-2 rounded`}>
            {isLandscape ? (
              <div className="flex flex-col items-center">
                <span className="text-xs transform -rotate-90 whitespace-nowrap">Header</span>
              </div>
            ) : (
              <span>Header</span>
            )}
          </div>
          
          <div className="flex-1 bg-gray-600 text-white p-4 rounded">
            Camera Area
          </div>
          
          <div className={`${isLandscape ? 'w-20' : 'w-full'} bg-gray-800 text-white p-2 rounded`}>
            <div className={`flex ${isLandscape ? 'flex-col space-y-2' : 'flex-row space-x-2'} items-center justify-center`}>
              <button className="w-8 h-8 bg-red-500 rounded-full">✕</button>
              <button className="w-8 h-8 bg-green-500 rounded-full">✓</button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <p>Rotate your device to test landscape mode detection.</p>
        <p>On mobile devices (≤768px width), landscape mode should activate when width > height.</p>
      </div>
    </div>
  );
};

export default LandscapeTest;