/**
 * SmartCroppingInterface Component
 * 
 * Displays a photo with smart-detected crop boundaries and draggable corner handles.
 * Uses the SmartPhotoDetector results to show the detected photo boundaries.
 * 
 * Features:
 * - Smart-detected crop area visualization
 * - Draggable corner handles for fine-tuning
 * - Real-time crop area updates
 * - Touch and mouse support
 * - Visual feedback for crop boundaries
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CornerPoints {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
}

interface SmartCroppingInterfaceProps {
  image: string;
  detectionResult: {
    detected: boolean;
    confidence: number;
    cropArea: CropArea;
    cornerPoints?: CornerPoints;
  };
  onCropComplete: (croppedImageData: string) => void;
  onCancel: () => void;
  isLandscape: boolean;
  aspectRatio: number;
  isMobile: boolean;
}

export const SmartCroppingInterface: React.FC<SmartCroppingInterfaceProps> = ({
  image,
  detectionResult,
  onCropComplete,
  onCancel,
  isLandscape,
  aspectRatio,
  isMobile
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [displayDimensions, setDisplayDimensions] = useState({ width: 0, height: 0 });
  const [cropArea, setCropArea] = useState<CornerPoints | null>(null);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageOrigin, setImageOrigin] = useState({ left: 0, top: 0 });

  // Initialize crop area from detection result
  useEffect(() => {
    if (
      imageLoaded &&
      displayDimensions.width > 0 &&
      imageDimensions.width > 0 &&
      detectionResult
    ) {
      // Helpers
      const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(val, max));
      const isFiniteNumber = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
      const isValidPoint = (p: any) => p && isFiniteNumber(p.x) && isFiniteNumber(p.y);
      const firstDefined = (...vals: any[]) => vals.find(v => v !== undefined && v !== null);

      // Convert from image coordinates to display coordinates
      const scaleX = displayDimensions.width / imageDimensions.width;
      const scaleY = displayDimensions.height / imageDimensions.height;

      let initialCropArea: CornerPoints | null = null;

      // Prefer precise corner points if available
      if (detectionResult.cornerPoints) {
        const cp: any = detectionResult.cornerPoints as any;
        // Support multiple naming conventions from detectors
        const rawTopLeft = firstDefined(cp.topLeft, cp.top_left, cp.tl, cp.topLeftCorner);
        const rawTopRight = firstDefined(cp.topRight, cp.top_right, cp.tr, cp.topRightCorner);
        const rawBottomLeft = firstDefined(cp.bottomLeft, cp.bottom_left, cp.bl, cp.bottomLeftCorner);
        const rawBottomRight = firstDefined(cp.bottomRight, cp.bottom_right, cp.br, cp.bottomRightCorner);

        if (isValidPoint(rawTopLeft) && isValidPoint(rawTopRight) && isValidPoint(rawBottomLeft) && isValidPoint(rawBottomRight)) {
          const toDisplay = (p: { x: number; y: number }) => ({
            x: clamp(p.x * scaleX, 0, displayDimensions.width),
            y: clamp(p.y * scaleY, 0, displayDimensions.height)
          });

          initialCropArea = {
            topLeft: toDisplay(rawTopLeft),
            topRight: toDisplay(rawTopRight),
            bottomLeft: toDisplay(rawBottomLeft),
            bottomRight: toDisplay(rawBottomRight)
          };
        }
      } else if (detectionResult.cropArea) {
        // Fallback to rectangular crop area
        const { x, y, width, height } = detectionResult.cropArea;
        const displayX = x * scaleX;
        const displayY = y * scaleY;
        const displayWidth = width * scaleX;
        const displayHeight = height * scaleY;

        initialCropArea = {
          topLeft: {
            x: clamp(displayX, 0, displayDimensions.width),
            y: clamp(displayY, 0, displayDimensions.height)
          },
          topRight: {
            x: clamp(displayX + displayWidth, 0, displayDimensions.width),
            y: clamp(displayY, 0, displayDimensions.height)
          },
          bottomLeft: {
            x: clamp(displayX, 0, displayDimensions.width),
            y: clamp(displayY + displayHeight, 0, displayDimensions.height)
          },
          bottomRight: {
            x: clamp(displayX + displayWidth, 0, displayDimensions.width),
            y: clamp(displayY + displayHeight, 0, displayDimensions.height)
          }
        };
      }

      if (initialCropArea) {
        setCropArea(initialCropArea);
      } else if (detectionResult.cropArea) {
        // As a last resort, ensure some interaction area exists based on the fallback rectangle within bounds
        const { x, y, width, height } = detectionResult.cropArea;
        const displayX = clamp(x * scaleX, 0, displayDimensions.width);
        const displayY = clamp(y * scaleY, 0, displayDimensions.height);
        const displayWidth = clamp(width * scaleX, 0, displayDimensions.width - displayX);
        const displayHeight = clamp(height * scaleY, 0, displayDimensions.height - displayY);
        setCropArea({
          topLeft: { x: displayX, y: displayY },
          topRight: { x: displayX + displayWidth, y: displayY },
          bottomLeft: { x: displayX, y: displayY + displayHeight },
          bottomRight: { x: displayX + displayWidth, y: displayY + displayHeight }
        });
      }
    }
  }, [imageLoaded, detectionResult, displayDimensions, imageDimensions, aspectRatio]);

  // Handle image load - maintain camera view aspect ratio for visual continuity
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!containerRef.current) return;

    const img = e.currentTarget;
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    
    // Get actual image dimensions
    const naturalWidth = img.naturalWidth || 800;
    const naturalHeight = img.naturalHeight || 600;
    setImageDimensions({ width: naturalWidth, height: naturalHeight });
    
    // Calculate display dimensions to maintain camera view aspect ratio
    const containerWidth = containerRect.width || 800;
    const containerHeight = containerRect.height || 600;
    
    // Calculate how the image should be displayed to match camera view aspect ratio
    const imageAspectRatio = naturalWidth / naturalHeight;
    let displayWidth = containerWidth;
    let displayHeight = containerHeight;
    
    if (Math.abs(imageAspectRatio - aspectRatio) > 0.01) {
      // Image aspect ratio doesn't match camera view aspect ratio
      // We need to crop the image to match the camera view
      if (imageAspectRatio > aspectRatio) {
        // Image is wider than camera view - crop width
        displayHeight = containerHeight;
        displayWidth = Math.round(containerHeight * aspectRatio);
      } else {
        // Image is taller than camera view - crop height  
        displayWidth = containerWidth;
        displayHeight = Math.round(containerWidth / aspectRatio);
      }
    }

    setDisplayDimensions({ width: displayWidth, height: displayHeight });
    // Calculate origin to center the image inside container
    const left = Math.max(0, Math.floor((containerWidth - displayWidth) / 2));
    const top = Math.max(0, Math.floor((containerHeight - displayHeight) / 2));
    setImageOrigin({ left, top });
    setImageLoaded(true);

    console.log('🖼️ Image loaded for cropping - maintaining camera view aspect ratio:', {
      naturalDimensions: { width: naturalWidth, height: naturalHeight },
      naturalAspectRatio: imageAspectRatio.toFixed(2),
      cameraAspectRatio: aspectRatio.toFixed(2),
      containerDimensions: { width: containerWidth, height: containerHeight },
      displayDimensions: { width: displayWidth, height: displayHeight }
    });
  }, [aspectRatio]);

  // Handle mouse/touch down on corner handles
  const handleMouseDown = useCallback((e: React.MouseEvent, corner: string) => {
    e.preventDefault();
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    setIsDragging(corner);
    setDragStart({ x: localX, y: localY });
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent, corner: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const touch = e.touches[0];
    if (touch) {
      if (!imageContainerRef.current) return;
      const rect = imageContainerRef.current.getBoundingClientRect();
      const localX = touch.clientX - rect.left;
      const localY = touch.clientY - rect.top;
      setIsDragging(corner);
      setDragStart({ x: localX, y: localY });
    }
  }, []);

  // Handle mouse/touch move for dragging
  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || !cropArea) return;
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const deltaX = localX - dragStart.x;
    const deltaY = localY - dragStart.y;

    const newCropArea = { ...cropArea };

    // Update only the dragged corner (image fills container, so constrain to container bounds)
    switch (isDragging) {
      case 'topLeft':
        newCropArea.topLeft.x = Math.max(0, Math.min(cropArea.topLeft.x + deltaX, displayDimensions.width));
        newCropArea.topLeft.y = Math.max(0, Math.min(cropArea.topLeft.y + deltaY, displayDimensions.height));
        break;
      case 'topRight':
        newCropArea.topRight.x = Math.max(0, Math.min(cropArea.topRight.x + deltaX, displayDimensions.width));
        newCropArea.topRight.y = Math.max(0, Math.min(cropArea.topRight.y + deltaY, displayDimensions.height));
        break;
      case 'bottomLeft':
        newCropArea.bottomLeft.x = Math.max(0, Math.min(cropArea.bottomLeft.x + deltaX, displayDimensions.width));
        newCropArea.bottomLeft.y = Math.max(0, Math.min(cropArea.bottomLeft.y + deltaY, displayDimensions.height));
        break;
      case 'bottomRight':
        newCropArea.bottomRight.x = Math.max(0, Math.min(cropArea.bottomRight.x + deltaX, displayDimensions.width));
        newCropArea.bottomRight.y = Math.max(0, Math.min(cropArea.bottomRight.y + deltaY, displayDimensions.height));
        break;
    }

    setCropArea(newCropArea);
    setDragStart({ x: localX, y: localY });
  }, [isDragging, cropArea, dragStart, displayDimensions]);

  // Handle mouse move for dragging
  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleMove(e.clientX, e.clientY);
  }, [handleMove]);

  // Handle touch move for dragging
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length > 0) {
      e.preventDefault();
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    }
  }, [handleMove]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    setIsDragging(null);
  }, []);

  // Handle crop completion
  const handleCropComplete = useCallback(() => {
    if (!cropArea) return;

    try {
      // Create canvas for cropping
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        if (!ctx) return;

        // Calculate crop bounding box in image coordinates (handles arbitrary quadrilateral)
        const scaleX = imageDimensions.width / displayDimensions.width;
        const scaleY = imageDimensions.height / displayDimensions.height;

        const xs = [cropArea.topLeft.x, cropArea.topRight.x, cropArea.bottomRight.x, cropArea.bottomLeft.x];
        const ys = [cropArea.topLeft.y, cropArea.topRight.y, cropArea.bottomRight.y, cropArea.bottomLeft.y];

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const cropX = Math.max(0, Math.round(minX * scaleX));
        const cropY = Math.max(0, Math.round(minY * scaleY));
        const cropWidth = Math.round((maxX - minX) * scaleX);
        const cropHeight = Math.round((maxY - minY) * scaleY);

        // Set canvas size to crop dimensions
        canvas.width = cropWidth;
        canvas.height = cropHeight;

        // Draw cropped image
        ctx.drawImage(
          img,
          cropX, cropY, cropWidth, cropHeight,
          0, 0, cropWidth, cropHeight
        );

        // Get cropped image data
        const croppedImageData = canvas.toDataURL('image/jpeg', 0.9);
        onCropComplete(croppedImageData);

        console.log('✂️ Crop completed (maintaining camera view aspect ratio):', {
          cropArea: { x: cropX, y: cropY, width: cropWidth, height: cropHeight },
          canvasSize: { width: canvas.width, height: canvas.height },
          finalAspectRatio: (cropWidth / cropHeight).toFixed(2),
          cameraAspectRatio: aspectRatio.toFixed(2)
        });
      };
      
      img.src = image;
    } catch (error) {
      console.error('❌ Crop completion failed:', error);
    }
  }, [cropArea, imageDimensions, displayDimensions, image, onCropComplete, aspectRatio]);

  // Set up mouse and touch event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // Render corner handle
  const renderCornerHandle = useCallback((corner: string, point: { x: number; y: number }) => {
    return (
      <div
        key={corner}
        className="absolute w-8 h-8 bg-blue-500 border-2 border-white rounded-full cursor-pointer transform -translate-x-1/2 -translate-y-1/2 hover:bg-blue-600 active:bg-blue-700 transition-colors shadow-lg z-20 touch-none select-none"
        style={{
          left: Math.round(point.x || 0),
          top: Math.round(point.y || 0),
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          pointerEvents: 'auto'
        }}
        onMouseDown={(e) => handleMouseDown(e, corner)}
        onTouchStart={(e) => handleTouchStart(e, corner)}
      />
    );
  }, [handleMouseDown, handleTouchStart]);

  // Render crop area overlay
  const renderCropOverlay = () => {
    if (!cropArea) return null;

    const containerWidth = displayDimensions.width || 800;
    const containerHeight = displayDimensions.height || 600;

    const points = `${Math.round(cropArea.topLeft.x)},${Math.round(cropArea.topLeft.y)} ${Math.round(cropArea.topRight.x)},${Math.round(cropArea.topRight.y)} ${Math.round(cropArea.bottomRight.x)},${Math.round(cropArea.bottomRight.y)} ${Math.round(cropArea.bottomLeft.x)},${Math.round(cropArea.bottomLeft.y)}`;

    return (
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 5 }}
        width={containerWidth}
        height={containerHeight}
        viewBox={`0 0 ${containerWidth} ${containerHeight}`}
      >
        {/* Dark overlay with cutout */}
        <defs>
          <mask id="cropMask">
            <rect width="100%" height="100%" fill="white" />
            <polygon points={points} fill="black" />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.6)"
          mask="url(#cropMask)"
        />

        {/* Crop area border */}
        <polygon
          points={points}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeDasharray="5,5"
        />
      </svg>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden">
      {/* Positioned image container exactly matching displayed image rect */}
      <div
        ref={imageContainerRef}
        className="absolute"
        style={{
          left: `${imageOrigin.left}px`,
          top: `${imageOrigin.top}px`,
          width: `${displayDimensions.width}px`,
          height: `${displayDimensions.height}px`
        }}
      >
        <img
          src={image}
          alt="Crop preview"
          className="w-full h-full object-contain"
          onLoad={handleImageLoad}
          draggable={false}
        />

        {/* Crop overlay and handles inside the same positioned box */}
        {imageLoaded && cropArea && (
          <>
            {renderCropOverlay()}
            {renderCornerHandle('topLeft', cropArea.topLeft)}
            {renderCornerHandle('topRight', cropArea.topRight)}
            {renderCornerHandle('bottomLeft', cropArea.bottomLeft)}
            {renderCornerHandle('bottomRight', cropArea.bottomRight)}
          </>
        )}
      </div>

      {/* Control Area */}
      <div className={`absolute z-20 ${
        isLandscape 
          ? 'right-0 top-0 bottom-0 w-32 flex flex-col justify-center items-center'
          : 'bottom-0 left-0 right-0 h-32 flex justify-center items-center'
      }`}>
        
        {/* Cancel and Accept buttons */}
        <div className={`flex ${
          isLandscape 
            ? 'flex-col gap-4 mb-8'
            : 'gap-6 mr-20'
        }`}>
          {/* Cancel Button */}
          <button
            onClick={onCancel}
            className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg"
            aria-label="Cancel cropping"
          >
            ✕
          </button>
        </div>

        {/* Accept Crop Button */}
        <button
          onClick={handleCropComplete}
          disabled={!cropArea}
          className="w-16 h-16 rounded-full border-4 border-white bg-green-500 hover:bg-green-600 active:scale-95 
            flex items-center justify-center text-2xl relative shadow-2xl transition-all duration-300"
          aria-label="Accept crop"
        >
          <span className="text-white">✓</span>
        </button>
      </div>
    </div>
  );
};

export default SmartCroppingInterface;
