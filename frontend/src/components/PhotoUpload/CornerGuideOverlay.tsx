/**
 * CornerGuideOverlay Component
 * 
 * Provides white/grey corner guides for photo positioning during camera capture.
 * Helps users align their photos properly and enhances smart cropping accuracy.
 * 
 * Features:
 * - Responsive corner guide positioning for different aspect ratios
 * - Visual feedback and animation when guides are properly aligned
 * - Accessibility features (high contrast mode, screen reader support)
 * - Guide visibility toggle for users who prefer minimal interface
 * - Integration with existing camera controls and quality indicators
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import './CornerGuideOverlay.css';

export interface CornerPoint {
  x: number;
  y: number;
}

export interface CornerPoints {
  topLeft: CornerPoint;
  topRight: CornerPoint;
  bottomLeft: CornerPoint;
  bottomRight: CornerPoint;
}

export interface CornerGuideProps {
  isVisible: boolean;
  isMobile?: boolean;
  onGuidePositionChange?: (corners: CornerPoints, orientation: 'portrait' | 'landscape') => void;
  className?: string;
}

export interface DualCornerPoints {
  portrait: CornerPoints;
  landscape: CornerPoints;
}

export const CornerGuideOverlay: React.FC<CornerGuideProps> = ({
  isVisible,
  isMobile = false,
  onGuidePositionChange,
  className = ''
}) => {
  const [dualCorners, setDualCorners] = useState<DualCornerPoints | null>(null);
  const [detectedOrientation, setDetectedOrientation] = useState<'portrait' | 'landscape' | null>(null);
  const [isAligned, setIsAligned] = useState(false);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [showPortraitGuides, setShowPortraitGuides] = useState(true);
  const [showLandscapeGuides, setShowLandscapeGuides] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Check for high contrast mode preference
  useEffect(() => {
    const checkHighContrast = () => {
      const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
      setIsHighContrast(prefersHighContrast);
    };

    checkHighContrast();
    
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    mediaQuery.addEventListener('change', checkHighContrast);
    
    return () => mediaQuery.removeEventListener('change', checkHighContrast);
  }, []);

  // Calculate guide positions for both portrait and landscape orientations
  const calculateDualGuidePositions = useCallback(() => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // Calculate camera view area bounds
    // Camera view is typically in the top portion of the screen
    const cameraViewTop = 0;
    const cameraViewBottom = screenHeight * 0.8; // Camera takes up 80% of screen height
    const cameraViewHeight = cameraViewBottom - cameraViewTop;
    // Move guides up by 5% from center
    const cameraViewCenterY = cameraViewTop + (cameraViewHeight / 2) - (cameraViewHeight * 0.05);
    const cameraViewCenterX = screenWidth / 2;
    
    // Ensure guides stay within camera view bounds with margin
    const margin = 50;
    const maxWidth = screenWidth - (margin * 2);
    const maxHeight = cameraViewHeight - (margin * 2);
    
    // Portrait guide (3:4 aspect ratio) - standard photo ratio - made EVEN TALLER
    // Calculate dimensions that maintain proper 3:4 aspect ratio
    const portraitWidth = Math.min(maxWidth * 0.8, maxHeight * 0.9);
    const portraitHeight = portraitWidth * (4/3); // 3:4 aspect ratio (height:width)
    
    // If height exceeds bounds, scale down width to fit
    const finalPortraitWidth = portraitHeight > maxHeight ? maxHeight * (3/4) : portraitWidth;
    const finalPortraitHeight = finalPortraitWidth * (4/3);
    
    const portraitCorners: CornerPoints = {
      topLeft: { x: cameraViewCenterX - finalPortraitWidth / 2, y: cameraViewCenterY - finalPortraitHeight / 2 },
      topRight: { x: cameraViewCenterX + finalPortraitWidth / 2, y: cameraViewCenterY - finalPortraitHeight / 2 },
      bottomLeft: { x: cameraViewCenterX - finalPortraitWidth / 2, y: cameraViewCenterY + finalPortraitHeight / 2 },
      bottomRight: { x: cameraViewCenterX + finalPortraitWidth / 2, y: cameraViewCenterY + finalPortraitHeight / 2 }
    };
    
    // Landscape guide (4:3 aspect ratio) - standard photo ratio - made WIDER
    // Calculate dimensions that maintain proper 4:3 aspect ratio
    const landscapeWidth = Math.min(maxWidth * 0.98, maxHeight * 0.7);
    const landscapeHeight = landscapeWidth * (3/4); // 4:3 aspect ratio (height:width)
    
    // If height exceeds bounds, scale down width to fit
    const finalLandscapeWidth = landscapeHeight > maxHeight ? maxHeight * (4/3) : landscapeWidth;
    const finalLandscapeHeight = finalLandscapeWidth * (3/4);
    
    const landscapeCorners: CornerPoints = {
      topLeft: { x: cameraViewCenterX - finalLandscapeWidth / 2, y: cameraViewCenterY - finalLandscapeHeight / 2 },
      topRight: { x: cameraViewCenterX + finalLandscapeWidth / 2, y: cameraViewCenterY - finalLandscapeHeight / 2 },
      bottomLeft: { x: cameraViewCenterX - finalLandscapeWidth / 2, y: cameraViewCenterY + finalLandscapeHeight / 2 },
      bottomRight: { x: cameraViewCenterX + finalLandscapeWidth / 2, y: cameraViewCenterY + finalLandscapeHeight / 2 }
    };
    
    return {
      portrait: portraitCorners,
      landscape: landscapeCorners
    };
  }, []);

  // Helper function to calculate quadrilateral area
  const calculateQuadrilateralArea = useCallback((corners: CornerPoints): number => {
    const { topLeft, topRight, bottomLeft, bottomRight } = corners;
    
    // Calculate area using shoelace formula
    const area = Math.abs(
      (topLeft.x * topRight.y + topRight.x * bottomRight.y + 
       bottomRight.x * bottomLeft.y + bottomLeft.x * topLeft.y) -
      (topLeft.y * topRight.x + topRight.y * bottomRight.x + 
       bottomRight.y * bottomLeft.x + bottomLeft.y * topLeft.x)
    ) / 2;
    
    return area;
  }, []);

  // Visual feedback for proper alignment and orientation detection
  const handleAlignmentCheck = useCallback(() => {
    const dualCorners = calculateDualGuidePositions();
    
    // Check if both guide sets are within reasonable bounds
    const tolerance = 20; // pixels
    const portraitValid = Object.values(dualCorners.portrait).every(corner => 
      corner.x > tolerance && corner.x < window.innerWidth - tolerance &&
      corner.y > tolerance && corner.y < window.innerHeight - tolerance
    );
    const landscapeValid = Object.values(dualCorners.landscape).every(corner => 
      corner.x > tolerance && corner.x < window.innerWidth - tolerance &&
      corner.y > tolerance && corner.y < window.innerHeight - tolerance
    );
    
    const isValid = portraitValid || landscapeValid;
    setIsAligned(isValid);
    setDualCorners(dualCorners);
    
    // Smart hiding logic: each guide hides only when the OTHER orientation is detected
    // By default, both guides are visible
    setShowPortraitGuides(true);
    setShowLandscapeGuides(true);
    
    // For now, always show both guides by default
    // In a real implementation, this would use computer vision to detect
    // which orientation the user is actually capturing
    setDetectedOrientation(null);
    
    // Call the callback with portrait corners by default (for compatibility)
    onGuidePositionChange?.(dualCorners.portrait, 'portrait');
    
    // TODO: Implement actual photo detection logic here
    // When a photo is detected within one orientation's bounds,
    // hide the other orientation's guides
  }, [calculateDualGuidePositions, calculateQuadrilateralArea, onGuidePositionChange]);

  // Update guide positions when props change
  useEffect(() => {
    if (isVisible) {
      handleAlignmentCheck();
    }
  }, [isVisible, handleAlignmentCheck]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (isVisible) {
        handleAlignmentCheck();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isVisible, handleAlignmentCheck]);

  if (!isVisible || !dualCorners) return null;

  const guideColor = isHighContrast ? '#ffffff' : '#ffffff';
  const guideOpacity = isHighContrast ? 0.9 : 0.7;
  const markerSize = isMobile ? 24 : 30;
  const portraitColor = '#ffffff';
  const landscapeColor = '#ffeb3b'; // Yellow for landscape guides

  return (
    <div 
      ref={overlayRef}
      className={`corner-guide-overlay absolute inset-0 pointer-events-none z-10 ${className}`}
      role="img"
      aria-label="Photo positioning guides for both portrait and landscape orientations"
    >
            {/* Portrait Corner Lines (White) - conditionally shown */}
            {showPortraitGuides && (
              <svg 
                className="guide-lines portrait" 
                style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  width: '100%', 
                  height: '100%', 
                  pointerEvents: 'none' 
                }}
                aria-hidden="true"
              >
                {/* Corner lines for portrait guide */}
                {/* Top-left corner */}
                <line 
                  x1={dualCorners.portrait.topLeft.x - 15} 
                  y1={dualCorners.portrait.topLeft.y} 
                  x2={dualCorners.portrait.topLeft.x + 15} 
                  y2={dualCorners.portrait.topLeft.y} 
                  stroke={portraitColor} 
                  strokeWidth="4" 
                  opacity={guideOpacity}
                />
                <line 
                  x1={dualCorners.portrait.topLeft.x} 
                  y1={dualCorners.portrait.topLeft.y - 15} 
                  x2={dualCorners.portrait.topLeft.x} 
                  y2={dualCorners.portrait.topLeft.y + 15} 
                  stroke={portraitColor} 
                  strokeWidth="4" 
                  opacity={guideOpacity}
                />
                {/* Top-right corner */}
                <line 
                  x1={dualCorners.portrait.topRight.x - 15} 
                  y1={dualCorners.portrait.topRight.y} 
                  x2={dualCorners.portrait.topRight.x + 15} 
                  y2={dualCorners.portrait.topRight.y} 
                  stroke={portraitColor} 
                  strokeWidth="4" 
                  opacity={guideOpacity}
                />
                <line 
                  x1={dualCorners.portrait.topRight.x} 
                  y1={dualCorners.portrait.topRight.y - 15} 
                  x2={dualCorners.portrait.topRight.x} 
                  y2={dualCorners.portrait.topRight.y + 15} 
                  stroke={portraitColor} 
                  strokeWidth="4" 
                  opacity={guideOpacity}
                />
                {/* Bottom-left corner */}
                <line 
                  x1={dualCorners.portrait.bottomLeft.x - 15} 
                  y1={dualCorners.portrait.bottomLeft.y} 
                  x2={dualCorners.portrait.bottomLeft.x + 15} 
                  y2={dualCorners.portrait.bottomLeft.y} 
                  stroke={portraitColor} 
                  strokeWidth="4" 
                  opacity={guideOpacity}
                />
                <line 
                  x1={dualCorners.portrait.bottomLeft.x} 
                  y1={dualCorners.portrait.bottomLeft.y - 15} 
                  x2={dualCorners.portrait.bottomLeft.x} 
                  y2={dualCorners.portrait.bottomLeft.y + 15} 
                  stroke={portraitColor} 
                  strokeWidth="4" 
                  opacity={guideOpacity}
                />
                {/* Bottom-right corner */}
                <line 
                  x1={dualCorners.portrait.bottomRight.x - 15} 
                  y1={dualCorners.portrait.bottomRight.y} 
                  x2={dualCorners.portrait.bottomRight.x + 15} 
                  y2={dualCorners.portrait.bottomRight.y} 
                  stroke={portraitColor} 
                  strokeWidth="4" 
                  opacity={guideOpacity}
                />
                <line 
                  x1={dualCorners.portrait.bottomRight.x} 
                  y1={dualCorners.portrait.bottomRight.y - 15} 
                  x2={dualCorners.portrait.bottomRight.x} 
                  y2={dualCorners.portrait.bottomRight.y + 15} 
                  stroke={portraitColor} 
                  strokeWidth="4" 
                  opacity={guideOpacity}
                />
              </svg>
            )}

            {/* Landscape Corner Lines (Yellow) - conditionally shown */}
            {showLandscapeGuides && (
              <svg 
                className="guide-lines landscape" 
                style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  width: '100%', 
                  height: '100%', 
                  pointerEvents: 'none' 
                }}
                aria-hidden="true"
              >
                {/* Corner lines for landscape guide */}
                {/* Top-left corner */}
                <line 
                  x1={dualCorners.landscape.topLeft.x - 15} 
                  y1={dualCorners.landscape.topLeft.y} 
                  x2={dualCorners.landscape.topLeft.x + 15} 
                  y2={dualCorners.landscape.topLeft.y} 
                  stroke={landscapeColor} 
                  strokeWidth="4" 
                  opacity={guideOpacity}
                />
                <line 
                  x1={dualCorners.landscape.topLeft.x} 
                  y1={dualCorners.landscape.topLeft.y - 15} 
                  x2={dualCorners.landscape.topLeft.x} 
                  y2={dualCorners.landscape.topLeft.y + 15} 
                  stroke={landscapeColor} 
                  strokeWidth="4" 
                  opacity={guideOpacity}
                />
                {/* Top-right corner */}
                <line 
                  x1={dualCorners.landscape.topRight.x - 15} 
                  y1={dualCorners.landscape.topRight.y} 
                  x2={dualCorners.landscape.topRight.x + 15} 
                  y2={dualCorners.landscape.topRight.y} 
                  stroke={landscapeColor} 
                  strokeWidth="4" 
                  opacity={guideOpacity}
                />
                <line 
                  x1={dualCorners.landscape.topRight.x} 
                  y1={dualCorners.landscape.topRight.y - 15} 
                  x2={dualCorners.landscape.topRight.x} 
                  y2={dualCorners.landscape.topRight.y + 15} 
                  stroke={landscapeColor} 
                  strokeWidth="4" 
                  opacity={guideOpacity}
                />
                {/* Bottom-left corner */}
                <line 
                  x1={dualCorners.landscape.bottomLeft.x - 15} 
                  y1={dualCorners.landscape.bottomLeft.y} 
                  x2={dualCorners.landscape.bottomLeft.x + 15} 
                  y2={dualCorners.landscape.bottomLeft.y} 
                  stroke={landscapeColor} 
                  strokeWidth="4" 
                  opacity={guideOpacity}
                />
                <line 
                  x1={dualCorners.landscape.bottomLeft.x} 
                  y1={dualCorners.landscape.bottomLeft.y - 15} 
                  x2={dualCorners.landscape.bottomLeft.x} 
                  y2={dualCorners.landscape.bottomLeft.y + 15} 
                  stroke={landscapeColor} 
                  strokeWidth="4" 
                  opacity={guideOpacity}
                />
                {/* Bottom-right corner */}
                <line 
                  x1={dualCorners.landscape.bottomRight.x - 15} 
                  y1={dualCorners.landscape.bottomRight.y} 
                  x2={dualCorners.landscape.bottomRight.x + 15} 
                  y2={dualCorners.landscape.bottomRight.y} 
                  stroke={landscapeColor} 
                  strokeWidth="4" 
                  opacity={guideOpacity}
                />
                <line 
                  x1={dualCorners.landscape.bottomRight.x} 
                  y1={dualCorners.landscape.bottomRight.y - 15} 
                  x2={dualCorners.landscape.bottomRight.x} 
                  y2={dualCorners.landscape.bottomRight.y + 15} 
                  stroke={landscapeColor} 
                  strokeWidth="4" 
                  opacity={guideOpacity}
                />
              </svg>
            )}

            {/* Portrait Guide Lines (White) - conditionally shown */}
            {showPortraitGuides && (
              <svg 
                className="guide-lines portrait" 
                style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  width: '100%', 
                  height: '100%', 
                  pointerEvents: 'none' 
                }}
                aria-hidden="true"
              >
                <line 
                  x1={dualCorners.portrait.topLeft.x} 
                  y1={dualCorners.portrait.topLeft.y} 
                  x2={dualCorners.portrait.topRight.x} 
                  y2={dualCorners.portrait.topRight.y} 
                  stroke={portraitColor} 
                  strokeWidth="2" 
                  strokeDasharray="5,5" 
                  opacity={guideOpacity}
                />
                <line 
                  x1={dualCorners.portrait.topRight.x} 
                  y1={dualCorners.portrait.topRight.y} 
                  x2={dualCorners.portrait.bottomRight.x} 
                  y2={dualCorners.portrait.bottomRight.y} 
                  stroke={portraitColor} 
                  strokeWidth="2" 
                  strokeDasharray="5,5" 
                  opacity={guideOpacity}
                />
                <line 
                  x1={dualCorners.portrait.bottomRight.x} 
                  y1={dualCorners.portrait.bottomRight.y} 
                  x2={dualCorners.portrait.bottomLeft.x} 
                  y2={dualCorners.portrait.bottomLeft.y} 
                  stroke={portraitColor} 
                  strokeWidth="2" 
                  strokeDasharray="5,5" 
                  opacity={guideOpacity}
                />
                <line 
                  x1={dualCorners.portrait.bottomLeft.x} 
                  y1={dualCorners.portrait.bottomLeft.y} 
                  x2={dualCorners.portrait.topLeft.x} 
                  y2={dualCorners.portrait.topLeft.y} 
                  stroke={portraitColor} 
                  strokeWidth="2" 
                  strokeDasharray="5,5" 
                  opacity={guideOpacity}
                />
              </svg>
            )}

            {/* Landscape Guide Lines (Yellow) - conditionally shown */}
            {showLandscapeGuides && (
              <svg 
                className="guide-lines landscape" 
                style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  width: '100%', 
                  height: '100%', 
                  pointerEvents: 'none' 
                }}
                aria-hidden="true"
              >
                <line 
                  x1={dualCorners.landscape.topLeft.x} 
                  y1={dualCorners.landscape.topLeft.y} 
                  x2={dualCorners.landscape.topRight.x} 
                  y2={dualCorners.landscape.topRight.y} 
                  stroke={landscapeColor} 
                  strokeWidth="2" 
                  strokeDasharray="5,5" 
                  opacity={guideOpacity}
                />
                <line 
                  x1={dualCorners.landscape.topRight.x} 
                  y1={dualCorners.landscape.topRight.y} 
                  x2={dualCorners.landscape.bottomRight.x} 
                  y2={dualCorners.landscape.bottomRight.y} 
                  stroke={landscapeColor} 
                  strokeWidth="2" 
                  strokeDasharray="5,5" 
                  opacity={guideOpacity}
                />
                <line 
                  x1={dualCorners.landscape.bottomRight.x} 
                  y1={dualCorners.landscape.bottomRight.y} 
                  x2={dualCorners.landscape.bottomLeft.x} 
                  y2={dualCorners.landscape.bottomLeft.y} 
                  stroke={landscapeColor} 
                  strokeWidth="2" 
                  strokeDasharray="5,5" 
                  opacity={guideOpacity}
                />
                <line 
                  x1={dualCorners.landscape.bottomLeft.x} 
                  y1={dualCorners.landscape.bottomLeft.y} 
                  x2={dualCorners.landscape.topLeft.x} 
                  y2={dualCorners.landscape.topLeft.y} 
                  stroke={landscapeColor} 
                  strokeWidth="2" 
                  strokeDasharray="5,5" 
                  opacity={guideOpacity}
                />
              </svg>
            )}
      


      {/* Alignment feedback */}
      {isAligned && (
        <div 
          className="alignment-feedback absolute inset-0 pointer-events-none"
          style={{
            background: detectedOrientation === 'portrait' 
              ? 'radial-gradient(circle at center, rgba(255, 255, 255, 0.1) 0%, transparent 70%)'
              : 'radial-gradient(circle at center, rgba(255, 235, 59, 0.1) 0%, transparent 70%)',
            animation: 'pulse 2s ease-in-out infinite'
          }}
          aria-label={`Guides are properly aligned for ${detectedOrientation} orientation`}
        />
      )}
    </div>
  );
};

export default CornerGuideOverlay;
