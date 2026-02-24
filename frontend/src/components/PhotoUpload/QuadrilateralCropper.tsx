import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { CropArea, CropAreaPixels } from './types';
import { SmartCroppingIndicator } from '../SmartCroppingIndicator';
import type { CornerPoints } from '../../types/jscanify';
import { 
  calculateScaleFactors, 
  convertJScanifyToQuad, 
  convertRectToQuad, 
  convertQuadToRect,
  validateCornerPoints,
  type QuadrilateralArea
} from '../../utils/cropConversions';

export interface QuadrilateralCropperProps {
  image: string; // base64 or URL
  onCropComplete: (croppedArea: CropArea, croppedAreaPixels: CropAreaPixels) => void;
  onCancel?: () => void;
  initialCropArea?: CropAreaPixels;
  jscanifyCornerPoints?: CornerPoints; // JScanify corner points for smart detection
  detectionConfidence?: number; // Confidence score from smart detection (0-1)
  isFullScreen?: boolean; // Default: true
  alignTop?: boolean; // Default: false (center), true for top alignment in portrait mode
}

interface QuadPoint {
  x: number;
  y: number;
}


export const QuadrilateralCropper: React.FC<QuadrilateralCropperProps> = ({
  image,
  onCropComplete,
  onCancel,
  initialCropArea,
  jscanifyCornerPoints,
  detectionConfidence,
  isFullScreen = true,
  alignTop = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [displayDimensions, setDisplayDimensions] = useState({ width: 0, height: 0 });
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [quadArea, setQuadArea] = useState<QuadrilateralArea | null>(null);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Memoize scale factors for better performance
  const scaleFactors = useMemo(() => 
    calculateScaleFactors(displayDimensions, imageDimensions),
    [displayDimensions, imageDimensions]
  );

  // Use shared utility function for JScanify conversion
  const convertJScanifyToQuadCallback = useCallback((cornerPoints: CornerPoints, imageX: number, imageY: number): QuadrilateralArea => {
    return convertJScanifyToQuad(cornerPoints, imageX, imageY, scaleFactors);
  }, [scaleFactors]);

  // Use shared utility function for rectangular conversion
  const convertRectToQuadCallback = useCallback((rect: CropAreaPixels, imageX: number, imageY: number): QuadrilateralArea => {
    // Only convert if we have valid dimensions
    if (displayDimensions.width === 0 || imageDimensions.width === 0) {
      // Return a default quad area if dimensions aren't ready
      return {
        topLeft: { x: imageX + 50, y: imageY + 50 },
        topRight: { x: imageX + 250, y: imageY + 50 },
        bottomLeft: { x: imageX + 50, y: imageY + 250 },
        bottomRight: { x: imageX + 250, y: imageY + 250 }
      };
    }

    return convertRectToQuad(rect, imageX, imageY, scaleFactors);
  }, [scaleFactors, displayDimensions.width, imageDimensions.width]);

  // Handle image load and preserve aspect ratio
  const handleImageLoad = useCallback(() => {
    if (!imageRef.current || !containerRef.current) return;

    const img = imageRef.current;
    const container = containerRef.current;

    // Get actual image dimensions with fallbacks for tests
    const naturalWidth = img.naturalWidth || 800;
    const naturalHeight = img.naturalHeight || 600;
    setImageDimensions({ width: naturalWidth, height: naturalHeight });

    // Calculate display dimensions while preserving aspect ratio
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width || window.innerWidth || 1024;
    const containerHeight = containerRect.height || window.innerHeight || 768;

    // Calculate available space for image display
    let availableWidth, availableHeight;

    if (isFullScreen) {
      // MINIMIZE BLACK BARS: Reserve only essential space for UI elements
      const bottomUISpace = 80; // Space for buttons at bottom
      const sideMargin = 20;    // Minimal side margins for corner handle accessibility
      const topMargin = 20;     // Minimal top margin for corner handle accessibility

      // Maximize available space by using minimal margins
      availableWidth = containerWidth - (sideMargin * 2);
      availableHeight = containerHeight - bottomUISpace - topMargin;

      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 Full-screen space calculation:', {
          containerWidth,
          containerHeight,
          availableWidth,
          availableHeight,
          reservedSpace: {
            bottom: bottomUISpace,
            sides: sideMargin * 2,
            top: topMargin
          }
        });
      }
    } else {
      // For non-full-screen mode, use the full container size since it's already constrained by CSS
      // (e.g., aspect-[3/4] class constrains the container to the correct aspect ratio)
      availableWidth = containerWidth;
      availableHeight = containerHeight;
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 Non-full-screen container dimensions:', {
          containerWidth,
          containerHeight,
          availableWidth,
          availableHeight,
          note: 'Using full container size (already constrained by CSS aspect ratio)'
        });
      }
    }

    const imageAspectRatio = naturalWidth / naturalHeight;
    const availableAspectRatio = availableWidth / availableHeight;

    let displayWidth, displayHeight;

    if (isFullScreen) {
      // PHOTO ACCURACY OPTIMIZATION: Handle 4:3 camera aspect ratio optimally
      if (process.env.NODE_ENV === 'development') {
        console.log('📐 Aspect ratio analysis:', {
          imageAspectRatio: imageAspectRatio.toFixed(2),
          availableAspectRatio: availableAspectRatio.toFixed(2),
          imageType: imageAspectRatio > 1.7 ? '16:9' : imageAspectRatio > 1.4 ? '3:2' : imageAspectRatio > 1.0 ? '4:3' : imageAspectRatio > 0.7 ? '3:4' : 'other',
          containerType: availableAspectRatio > 1.7 ? '16:9' : availableAspectRatio > 1.4 ? '3:2' : availableAspectRatio > 1.0 ? '4:3' : '3:4',
          imageDimensions: { width: naturalWidth, height: naturalHeight },
          containerDimensions: { width: availableWidth, height: availableHeight }
        });
      }

      // For 4:3 and 3:4 images (our preferred camera formats), optimize display
      const is43Image = imageAspectRatio >= 1.2 && imageAspectRatio <= 1.5; // 4:3 landscape (more inclusive)
      const is34Image = imageAspectRatio >= 0.65 && imageAspectRatio <= 0.85;  // 3:4 portrait (more inclusive)

      console.log('� Camerra format detection:', {
        imageAspectRatio: imageAspectRatio.toFixed(3),
        isCameraFormat: is43Image ? '4:3' : is34Image ? '3:4' : false
      });

      // For crop view in full-screen mode, always fill the container to maximize visibility
      // This ensures users can see the entire photo without black bars for accurate cropping
      displayWidth = availableWidth;
      displayHeight = availableHeight;
      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 Full-screen crop view - filling container completely for optimal visibility');
      }
    } else {
      // For non-full-screen mode, respect container aspect ratio for visual continuity
      // but maximize image visibility within those constraints
      const aspectRatioMatch = Math.abs(imageAspectRatio - availableAspectRatio) < 0.2;
      const aspectRatioDifference = Math.abs(imageAspectRatio - availableAspectRatio);

      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Non-full-screen crop view aspect ratio analysis:', {
          imageAspectRatio: imageAspectRatio.toFixed(3),
          availableAspectRatio: availableAspectRatio.toFixed(3),
          difference: aspectRatioDifference.toFixed(3),
          match: aspectRatioMatch,
          containerDimensions: { width: availableWidth, height: availableHeight }
        });
      }

      // For non-full-screen crop view, always fill the available container space
      // This ensures the image fills the aspect-ratio constrained container (like aspect-[3/4])
      // while maintaining visual continuity with the camera view
      displayWidth = availableWidth;
      displayHeight = availableHeight;
      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 Non-full-screen crop view - filling constrained container for visual continuity:', {
          finalDimensions: { width: displayWidth, height: displayHeight },
          containerDimensions: { width: containerWidth, height: containerHeight },
          aspectRatios: {
            image: imageAspectRatio.toFixed(3),
            container: availableAspectRatio.toFixed(3)
          }
        });
      }
    }

    // Ensure minimum dimensions
    displayWidth = Math.max(displayWidth, 200);
    displayHeight = Math.max(displayHeight, 200);

    // CENTER THE IMAGE: Position image in the center of available space
    let imageX, imageY;

    if (isFullScreen) {
      // For full-screen, position based on alignTop preference
      const topMargin = 20;
      const availableVerticalSpace = containerHeight - 80 - topMargin; // Bottom UI space + top margin

      imageX = (containerWidth - displayWidth) / 2;

      if (alignTop) {
        // Position at top with small margin
        imageY = topMargin;
      } else {
        // Center vertically in available space
        imageY = topMargin + (availableVerticalSpace - displayHeight) / 2;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 Image positioning (full-screen):', {
          containerDimensions: { width: containerWidth, height: containerHeight },
          displayDimensions: { width: displayWidth, height: displayHeight },
          imagePosition: { x: imageX, y: imageY },
          alignTop,
          margins: { top: topMargin, bottom: 80 }
        });
      }
    } else {
      // For windowed mode, use alignTop preference
      imageX = (containerWidth - displayWidth) / 2;

      if (alignTop) {
        // Position at top with small margin
        imageY = 10;
      } else {
        // Center vertically
        imageY = (containerHeight - displayHeight) / 2;
      }
    }

    setDisplayDimensions({ width: displayWidth, height: displayHeight });
    setImagePosition({ x: imageX, y: imageY });

    // Set initial quadrilateral area - prioritize JScanify corner points
    const defaultQuadArea = (() => {
      // Priority 1: JScanify corner points (smart detection)
      if (jscanifyCornerPoints && displayDimensions.width > 0 && imageDimensions.width > 0) {
        if (validateCornerPoints(jscanifyCornerPoints)) {
          if (process.env.NODE_ENV === 'development') {
            console.log('🎯 Using JScanify corner points for initial crop area', {
              cornerPoints: jscanifyCornerPoints,
              confidence: detectionConfidence
            });
          }
          return convertJScanifyToQuadCallback(jscanifyCornerPoints, imageX, imageY);
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Invalid JScanify corner points detected, falling back to default crop area', {
              cornerPoints: jscanifyCornerPoints
            });
          }
        }
      }

      // Priority 2: Initial crop area (manual detection)
      if (initialCropArea) {
        if (process.env.NODE_ENV === 'development') {
          console.log('📐 Using initial crop area for quadrilateral');
        }
        return convertRectToQuadCallback(initialCropArea, imageX, imageY);
      }

      // Priority 3: Default centered crop area
      if (process.env.NODE_ENV === 'development') {
        console.log('📐 Using default centered crop area');
      }
      const imageCenterX = imageX + displayWidth / 2;
      const imageCenterY = imageY + displayHeight / 2;

      // Crop area is 80% of image size, perfectly centered
      const cropWidth = displayWidth * 0.8;
      const cropHeight = displayHeight * 0.8;

      const cropHalfWidth = cropWidth / 2;
      const cropHalfHeight = cropHeight / 2;

      const centeredCropArea = {
        topLeft: { x: imageCenterX - cropHalfWidth, y: imageCenterY - cropHalfHeight },
        topRight: { x: imageCenterX + cropHalfWidth, y: imageCenterY - cropHalfHeight },
        bottomLeft: { x: imageCenterX - cropHalfWidth, y: imageCenterY + cropHalfHeight },
        bottomRight: { x: imageCenterX + cropHalfWidth, y: imageCenterY + cropHalfHeight }
      };

        if (process.env.NODE_ENV === 'development') {
          console.log('📐 Centered crop area calculation:', {
            imagePosition: { x: imageX, y: imageY },
            displayDimensions: { width: displayWidth, height: displayHeight },
            imageCenter: { x: imageCenterX, y: imageCenterY },
            cropDimensions: { width: cropWidth, height: cropHeight },
            cropArea: centeredCropArea
          });
        }

      return centeredCropArea;
    })();

    setQuadArea(defaultQuadArea);
    
    // Small delay to ensure corner handles are fully rendered before becoming interactive
    setTimeout(() => {
      setImageLoaded(true);
    }, 50);
  }, [initialCropArea, jscanifyCornerPoints, detectionConfidence, convertRectToQuadCallback, convertJScanifyToQuadCallback, isFullScreen, alignTop, displayDimensions.width, imageDimensions.width]);



  /**
   * Convert quadrilateral to rectangular crop area for output
   * @param quad - QuadrilateralArea with display coordinates
   * @returns Object containing both relative and pixel-based crop areas
   */
  // Use shared utility function for quadrilateral to rectangle conversion
  const convertQuadToRectCallback = useCallback((quad: QuadrilateralArea): { area: CropArea; pixels: CropAreaPixels } => {
    return convertQuadToRect(quad, imagePosition.x, imagePosition.y, scaleFactors);
  }, [imagePosition.x, imagePosition.y, scaleFactors]);

  // Handle mouse down on corner handles
  const handleMouseDown = useCallback((e: React.MouseEvent, corner: string) => {
    e.preventDefault();
    setIsDragging(corner);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  // Handle touch start on corner handles
  const handleTouchStart = useCallback((e: React.TouchEvent, corner: string) => {
    e.preventDefault(); // Prevent scrolling and other touch behaviors
    e.stopPropagation(); // Prevent event bubbling
    
    const touch = e.touches[0];
    if (touch) {
      setIsDragging(corner);
      setDragStart({ x: touch.clientX, y: touch.clientY });
    }
  }, []);

  // Handle mouse/touch move for dragging
  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || !quadArea || !imageRef.current) return;

    const deltaX = clientX - dragStart.x;
    const deltaY = clientY - dragStart.y;

    const newQuadArea = { ...quadArea };

    // Update only the dragged corner
    switch (isDragging) {
      case 'topLeft':
        newQuadArea.topLeft.x = Math.max(imagePosition.x, Math.min(quadArea.topLeft.x + deltaX, imagePosition.x + displayDimensions.width));
        newQuadArea.topLeft.y = Math.max(imagePosition.y, Math.min(quadArea.topLeft.y + deltaY, imagePosition.y + displayDimensions.height));
        break;
      case 'topRight':
        newQuadArea.topRight.x = Math.max(imagePosition.x, Math.min(quadArea.topRight.x + deltaX, imagePosition.x + displayDimensions.width));
        newQuadArea.topRight.y = Math.max(imagePosition.y, Math.min(quadArea.topRight.y + deltaY, imagePosition.y + displayDimensions.height));
        break;
      case 'bottomLeft':
        newQuadArea.bottomLeft.x = Math.max(imagePosition.x, Math.min(quadArea.bottomLeft.x + deltaX, imagePosition.x + displayDimensions.width));
        newQuadArea.bottomLeft.y = Math.max(imagePosition.y, Math.min(quadArea.bottomLeft.y + deltaY, imagePosition.y + displayDimensions.height));
        break;
      case 'bottomRight':
        newQuadArea.bottomRight.x = Math.max(imagePosition.x, Math.min(quadArea.bottomRight.x + deltaX, imagePosition.x + displayDimensions.width));
        newQuadArea.bottomRight.y = Math.max(imagePosition.y, Math.min(quadArea.bottomRight.y + deltaY, imagePosition.y + displayDimensions.height));
        break;
    }

    setQuadArea(newQuadArea);
    setDragStart({ x: clientX, y: clientY });
  }, [isDragging, quadArea, dragStart, imagePosition, displayDimensions]);

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

  // Handle accept button click
  const handleAccept = useCallback(() => {
    if (!quadArea) return;

    const { area, pixels } = convertQuadToRectCallback(quadArea);
    onCropComplete(area, pixels);
  }, [quadArea, convertQuadToRectCallback, onCropComplete]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onCancel) {
        onCancel();
      } else if (event.key === 'Enter') {
        handleAccept();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, handleAccept]);

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

  // Prevent body scroll in full-screen mode
  useEffect(() => {
    if (isFullScreen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isFullScreen]);

  const containerClasses = isFullScreen
    ? 'fixed inset-0 z-50 bg-black'
    : 'relative w-full h-full bg-black overflow-hidden';

  const containerStyle = isFullScreen ? {
    width: '100vw',
    height: '100vh'
  } : {};

  const renderCornerHandle = useCallback((corner: string, point: QuadPoint) => {
    // Debug logging for corner handle positioning
    if (process.env.NODE_ENV === 'development') {
      console.log(`🎯 Rendering ${corner} corner at:`, { x: point.x, y: point.y });
    }
    
    return (
      <div
        key={corner}
        className="absolute w-12 h-12 bg-cozy-accent border-3 border-white rounded-full cursor-pointer transform -translate-x-1/2 -translate-y-1/2 hover:bg-cozy-accentDark active:opacity-90 transition-colors shadow-lg z-20 touch-none select-none"
        style={{
          left: Math.round(point.x || 0),
          top: Math.round(point.y || 0),
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          minWidth: '48px',
          minHeight: '48px',
          pointerEvents: 'auto' // Ensure pointer events are enabled
        }}
        onMouseDown={(e) => {
          if (process.env.NODE_ENV === 'development') {
            console.log(`🖱️ Mouse down on ${corner} corner`);
          }
          handleMouseDown(e, corner);
        }}
        onTouchStart={(e) => {
          if (process.env.NODE_ENV === 'development') {
            console.log(`👆 Touch start on ${corner} corner`);
          }
          handleTouchStart(e, corner);
        }}
      />
    );
  }, [handleMouseDown, handleTouchStart]);

  const renderQuadrilateral = (quad: QuadrilateralArea) => {
    // Get container dimensions for proper SVG sizing
    const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
    const containerHeight = containerRef.current?.clientHeight || window.innerHeight;

    const points = `${Math.round(quad.topLeft.x)},${Math.round(quad.topLeft.y)} ${Math.round(quad.topRight.x)},${Math.round(quad.topRight.y)} ${Math.round(quad.bottomRight.x)},${Math.round(quad.bottomRight.y)} ${Math.round(quad.bottomLeft.x)},${Math.round(quad.bottomLeft.y)}`;

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

        {/* Quadrilateral border */}
        <polygon
          points={points}
          fill="none"
          stroke="#c9a882"
          strokeWidth="2"
          strokeDasharray="5,5"
        />

        {/* Grid lines inside quadrilateral */}
        <g stroke="#c9a882" strokeWidth="1" opacity="0.5">
          {/* Horizontal grid lines */}
          <line
            x1={Math.round(quad.topLeft.x + (quad.topRight.x - quad.topLeft.x) * 0.33)}
            y1={Math.round(quad.topLeft.y + (quad.topRight.y - quad.topLeft.y) * 0.33)}
            x2={Math.round(quad.bottomLeft.x + (quad.bottomRight.x - quad.bottomLeft.x) * 0.33)}
            y2={Math.round(quad.bottomLeft.y + (quad.bottomRight.y - quad.bottomLeft.y) * 0.33)}
          />
          <line
            x1={Math.round(quad.topLeft.x + (quad.topRight.x - quad.topLeft.x) * 0.67)}
            y1={Math.round(quad.topLeft.y + (quad.topRight.y - quad.topLeft.y) * 0.67)}
            x2={Math.round(quad.bottomLeft.x + (quad.bottomRight.x - quad.bottomLeft.x) * 0.67)}
            y2={Math.round(quad.bottomLeft.y + (quad.bottomRight.y - quad.bottomLeft.y) * 0.67)}
          />
          {/* Vertical grid lines */}
          <line
            x1={Math.round(quad.topLeft.x + (quad.bottomLeft.x - quad.topLeft.x) * 0.33)}
            y1={Math.round(quad.topLeft.y + (quad.bottomLeft.y - quad.topLeft.y) * 0.33)}
            x2={Math.round(quad.topRight.x + (quad.bottomRight.x - quad.topRight.x) * 0.33)}
            y2={Math.round(quad.topRight.y + (quad.bottomRight.y - quad.topRight.y) * 0.33)}
          />
          <line
            x1={Math.round(quad.topLeft.x + (quad.bottomLeft.x - quad.topLeft.x) * 0.67)}
            y1={Math.round(quad.topLeft.y + (quad.bottomLeft.y - quad.topLeft.y) * 0.67)}
            x2={Math.round(quad.topRight.x + (quad.bottomRight.x - quad.topRight.x) * 0.67)}
            y2={Math.round(quad.topRight.y + (quad.bottomRight.y - quad.topRight.y) * 0.67)}
          />
        </g>
      </svg>
    );
  };

  return (
    <div ref={containerRef} className={containerClasses} style={containerStyle}>
      {/* Image with preserved aspect ratio */}
      <div className="relative w-full h-full">
        <div
          ref={imageRef}
          className="absolute"
          style={{
            left: imagePosition.x,
            top: imagePosition.y,
            width: displayDimensions.width,
            height: displayDimensions.height
          }}
        >
          <Image
            src={image}
            alt="Crop preview"
            fill
            className="object-contain"
            onLoad={handleImageLoad}
            draggable={false}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>

        {/* Quadrilateral Overlay */}
        {imageLoaded && quadArea && (
          <>
            {renderQuadrilateral(quadArea)}

            {/* Corner Handles */}
            {renderCornerHandle('topLeft', quadArea.topLeft)}
            {renderCornerHandle('topRight', quadArea.topRight)}
            {renderCornerHandle('bottomLeft', quadArea.bottomLeft)}
            {renderCornerHandle('bottomRight', quadArea.bottomRight)}
          </>
        )}
      </div>

      {/* Smart Detection Status - positioned at top with lower z-index */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-5">
        <div className="bg-black bg-opacity-75 text-white px-3 py-2 rounded-lg">
          <SmartCroppingIndicator 
            hasSmartDetection={!!jscanifyCornerPoints}
            confidence={detectionConfidence}
          />
        </div>
      </div>

      {/* Controls - positioned safely inside screen bounds */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-4 px-4">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-cozy-accentDark hover:opacity-90 text-white font-serif font-medium rounded-cozy-md transition-colors duration-200 shadow-cozy-card"
            type="button"
          >
            Cancel
          </button>
        )}

        <button
          onClick={handleAccept}
          disabled={!quadArea}
          className="px-6 py-3 bg-cozySemantic-success hover:opacity-90 disabled:bg-cozy-accentDark disabled:cursor-not-allowed text-white font-serif font-medium rounded-cozy-md transition-colors duration-200 shadow-cozy-card"
          type="button"
        >
          ✓ Crop
        </button>
      </div>
    </div>
  );
};

export default QuadrilateralCropper;