import type { CornerPoints } from '../types/jscanify';
import type { CropAreaPixels, CropArea } from '../types/upload';

export interface QuadrilateralArea {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
}

export interface ScaleFactors {
  scaleX: number;
  scaleY: number;
}

/**
 * Calculate scale factors for converting between image and display coordinates
 * @param displayDimensions - Display dimensions
 * @param imageDimensions - Image dimensions
 * @returns Scale factors for X and Y coordinates
 */
export const calculateScaleFactors = (
  displayDimensions: { width: number; height: number },
  imageDimensions: { width: number; height: number }
): ScaleFactors => ({
  scaleX: displayDimensions.width / imageDimensions.width,
  scaleY: displayDimensions.height / imageDimensions.height
});

/**
 * Convert JScanify corner points to QuadrilateralArea format for display coordinates
 * @param cornerPoints - JScanify corner points in image coordinates
 * @param imageX - X position of image in display coordinates
 * @param imageY - Y position of image in display coordinates
 * @param scaleFactors - Pre-calculated scale factors
 * @returns QuadrilateralArea with display coordinates for UI rendering
 */
export const convertJScanifyToQuad = (
  cornerPoints: CornerPoints,
  imageX: number,
  imageY: number,
  scaleFactors: ScaleFactors
): QuadrilateralArea => {
  const { scaleX, scaleY } = scaleFactors;

  return {
    topLeft: {
      x: imageX + (cornerPoints.topLeftCorner.x * scaleX),
      y: imageY + (cornerPoints.topLeftCorner.y * scaleY)
    },
    topRight: {
      x: imageX + (cornerPoints.topRightCorner.x * scaleX),
      y: imageY + (cornerPoints.topRightCorner.y * scaleY)
    },
    bottomLeft: {
      x: imageX + (cornerPoints.bottomLeftCorner.x * scaleX),
      y: imageY + (cornerPoints.bottomLeftCorner.y * scaleY)
    },
    bottomRight: {
      x: imageX + (cornerPoints.bottomRightCorner.x * scaleX),
      y: imageY + (cornerPoints.bottomRightCorner.y * scaleY)
    }
  };
};

/**
 * Convert rectangular crop area to quadrilateral format for display coordinates
 * @param rect - Rectangular crop area in image coordinates
 * @param imageX - X position of image in display coordinates
 * @param imageY - Y position of image in display coordinates
 * @param scaleFactors - Pre-calculated scale factors
 * @returns QuadrilateralArea with display coordinates for UI rendering
 */
export const convertRectToQuad = (
  rect: CropAreaPixels,
  imageX: number,
  imageY: number,
  scaleFactors: ScaleFactors
): QuadrilateralArea => {
  const { scaleX, scaleY } = scaleFactors;

  const displayX = imageX + (rect.x * scaleX);
  const displayY = imageY + (rect.y * scaleY);
  const displayWidth = rect.width * scaleX;
  const displayHeight = rect.height * scaleY;

  return {
    topLeft: { x: displayX, y: displayY },
    topRight: { x: displayX + displayWidth, y: displayY },
    bottomLeft: { x: displayX, y: displayY + displayHeight },
    bottomRight: { x: displayX + displayWidth, y: displayY + displayHeight }
  };
};

/**
 * Convert quadrilateral to rectangular crop area for output
 * @param quad - QuadrilateralArea with display coordinates
 * @param imageX - X position of image in display coordinates
 * @param imageY - Y position of image in display coordinates
 * @param scaleFactors - Pre-calculated scale factors
 * @returns Object containing both relative and pixel-based crop areas
 */
export const convertQuadToRect = (
  quad: QuadrilateralArea,
  imageX: number,
  imageY: number,
  scaleFactors: ScaleFactors
): { area: CropArea; pixels: CropAreaPixels } => {
  // Find bounding rectangle of the quadrilateral
  const minX = Math.min(quad.topLeft.x, quad.topRight.x, quad.bottomLeft.x, quad.bottomRight.x);
  const maxX = Math.max(quad.topLeft.x, quad.topRight.x, quad.bottomLeft.x, quad.bottomRight.x);
  const minY = Math.min(quad.topLeft.y, quad.topRight.y, quad.bottomLeft.y, quad.bottomRight.y);
  const maxY = Math.max(quad.topLeft.y, quad.topRight.y, quad.bottomLeft.y, quad.bottomRight.y);

  const { scaleX, scaleY } = scaleFactors;

  // Convert back to image coordinates
  const x = (minX - imageX) / scaleX;
  const y = (minY - imageY) / scaleY;
  const width = (maxX - minX) / scaleX;
  const height = (maxY - minY) / scaleY;

  const cropArea: CropAreaPixels = {
    x: Math.max(0, Math.round(x)),
    y: Math.max(0, Math.round(y)),
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height))
  };

  return {
    area: cropArea,
    pixels: cropArea
  };
};

/**
 * Validate JScanify corner points data integrity
 * @param cornerPoints - JScanify corner points to validate
 * @returns True if corner points are valid, false otherwise
 */
export const validateCornerPoints = (cornerPoints: CornerPoints): boolean => {
  if (!cornerPoints) return false;

  const { topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner } = cornerPoints;

  // Check if all corners exist and have valid coordinates
  const corners = [topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner];
  
  return corners.every(corner => 
    corner && 
    typeof corner.x === 'number' && 
    typeof corner.y === 'number' &&
    !isNaN(corner.x) && 
    !isNaN(corner.y) &&
    corner.x >= 0 && 
    corner.y >= 0
  );
};
