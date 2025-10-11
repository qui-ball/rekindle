/**
 * Comprehensive confidence scoring for photo boundary detection
 * 
 * Implements multiple quality metrics to determine detection confidence:
 * - Area ratio: Size of detected region relative to image
 * - Rectangularity: How close the shape is to a perfect rectangle
 * - Distribution: How evenly corners are distributed
 * - Straightness: How straight the edges are
 */

import type { CornerPoints } from '../types/jscanify';

export interface ConfidenceMetrics {
  areaRatio: number;        // 0-1: Size of detected region vs image
  rectangularity: number;   // 0-1: How rectangular the shape is
  distribution: number;      // 0-1: How evenly distributed corners are
  straightness: number;      // 0-1: How straight the edges are
  overall: number;           // 0-1: Combined confidence score
}

export interface ConfidenceWeights {
  area: number;
  rectangularity: number;
  distribution: number;
  straightness: number;
}

/**
 * Default weights for confidence scoring
 * Total should equal 1.0 for proper normalization
 */
export const DEFAULT_WEIGHTS: ConfidenceWeights = {
  area: 0.3,              // 30% - Reasonable size is important
  rectangularity: 0.3,    // 30% - Shape quality is critical
  distribution: 0.2,      // 20% - Corner spacing matters
  straightness: 0.2       // 20% - Edge quality matters
};

/**
 * Calculate comprehensive confidence score for detected corners
 */
export function calculateConfidenceScore(
  cornerPoints: CornerPoints,
  imageWidth: number,
  imageHeight: number,
  weights: ConfidenceWeights = DEFAULT_WEIGHTS
): ConfidenceMetrics {
  const areaRatio = calculateAreaRatio(cornerPoints, imageWidth, imageHeight);
  const rectangularity = calculateRectangularity(cornerPoints);
  const distribution = calculateDistribution(cornerPoints, imageWidth, imageHeight);
  const straightness = calculateStraightness(cornerPoints);
  
  // Guard against NaN values from degenerate cases (e.g., all points collinear)
  const safeAreaRatio = isNaN(areaRatio) ? 0 : areaRatio;
  const safeRectangularity = isNaN(rectangularity) ? 0 : rectangularity;
  const safeDistribution = isNaN(distribution) ? 0 : distribution;
  const safeStraightness = isNaN(straightness) ? 0 : straightness;
  
  // Weighted combination
  const overall = 
    safeAreaRatio * weights.area +
    safeRectangularity * weights.rectangularity +
    safeDistribution * weights.distribution +
    safeStraightness * weights.straightness;
  
  return {
    areaRatio: safeAreaRatio,
    rectangularity: safeRectangularity,
    distribution: safeDistribution,
    straightness: safeStraightness,
    overall: isNaN(overall) ? 0 : Math.min(1.0, Math.max(0.0, overall))
  };
}

/**
 * Calculate area ratio: detected region size vs image size
 * Returns 0-1 score where higher is better
 */
function calculateAreaRatio(
  cornerPoints: CornerPoints,
  imageWidth: number,
  imageHeight: number
): number {
  const area = calculatePolygonArea(cornerPoints);
  const imageArea = imageWidth * imageHeight;
  const ratio = area / imageArea;
  
  // Ideal range: 40-80% of image (0.4-0.8)
  // Score gradually decreases outside this range
  if (ratio >= 0.4 && ratio <= 0.8) {
    return 1.0; // Perfect range
  } else if (ratio >= 0.2 && ratio < 0.4) {
    return (ratio - 0.2) / 0.2; // Linear scale from 0.2 to 0.4
  } else if (ratio > 0.8 && ratio <= 0.95) {
    return 1.0 - (ratio - 0.8) / 0.15; // Linear decrease from 0.8 to 0.95
  } else if (ratio < 0.2) {
    return ratio / 0.2; // Very small detections
  } else {
    return Math.max(0, 1.0 - (ratio - 0.95) / 0.05); // Very large detections
  }
}

/**
 * Calculate rectangularity: how close the shape is to a rectangle
 * Returns 0-1 score where 1.0 is a perfect rectangle
 */
function calculateRectangularity(cornerPoints: CornerPoints): number {
  const { topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner } = cornerPoints;
  
  // Calculate edge lengths
  const topEdge = distance(topLeftCorner, topRightCorner);
  const rightEdge = distance(topRightCorner, bottomRightCorner);
  const bottomEdge = distance(bottomRightCorner, bottomLeftCorner);
  const leftEdge = distance(bottomLeftCorner, topLeftCorner);
  
  // Opposite edges should be similar length in a rectangle
  const horizontalRatio = Math.min(topEdge, bottomEdge) / Math.max(topEdge, bottomEdge);
  const verticalRatio = Math.min(leftEdge, rightEdge) / Math.max(leftEdge, rightEdge);
  
  // Calculate angles (should be ~90 degrees)
  const angle1 = calculateAngle(topLeftCorner, topRightCorner, bottomRightCorner);
  const angle2 = calculateAngle(topRightCorner, bottomRightCorner, bottomLeftCorner);
  const angle3 = calculateAngle(bottomRightCorner, bottomLeftCorner, topLeftCorner);
  const angle4 = calculateAngle(bottomLeftCorner, topLeftCorner, topRightCorner);
  
  // Average angle deviation from 90 degrees (in radians)
  const avgAngleDeviation = 
    (Math.abs(angle1 - Math.PI / 2) +
     Math.abs(angle2 - Math.PI / 2) +
     Math.abs(angle3 - Math.PI / 2) +
     Math.abs(angle4 - Math.PI / 2)) / 4;
  
  // Angle score: perfect right angles get 1.0
  const angleScore = Math.max(0, 1.0 - (avgAngleDeviation / (Math.PI / 6))); // Allow up to 30° deviation
  
  // Combine edge ratio and angle scores
  return (horizontalRatio + verticalRatio + angleScore) / 3;
}

/**
 * Calculate distribution: how evenly corners are distributed
 * Returns 0-1 score where 1.0 is perfectly distributed
 */
function calculateDistribution(
  cornerPoints: CornerPoints,
  imageWidth: number,
  imageHeight: number
): number {
  const { topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner } = cornerPoints;
  
  // Calculate center of mass
  const centerX = (topLeftCorner.x + topRightCorner.x + bottomRightCorner.x + bottomLeftCorner.x) / 4;
  const centerY = (topLeftCorner.y + topRightCorner.y + bottomRightCorner.y + bottomLeftCorner.y) / 4;
  
  // Ideal center is at image center
  const imageCenterX = imageWidth / 2;
  const imageCenterY = imageHeight / 2;
  const centerDeviation = Math.sqrt(
    Math.pow(centerX - imageCenterX, 2) + Math.pow(centerY - imageCenterY, 2)
  );
  const maxDeviation = Math.sqrt(Math.pow(imageWidth / 2, 2) + Math.pow(imageHeight / 2, 2));
  const centerScore = 1.0 - (centerDeviation / maxDeviation);
  
  // Check corner spacing - adjacent corners should be reasonably spaced
  const corners = [topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner];
  const distances: number[] = [];
  for (let i = 0; i < corners.length; i++) {
    const next = corners[(i + 1) % corners.length];
    distances.push(distance(corners[i], next));
  }
  
  // Calculate variance in distances (lower is better)
  const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
  const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length;
  const stdDev = Math.sqrt(variance);
  const spacingScore = Math.max(0, 1.0 - (stdDev / avgDistance));
  
  return (centerScore + spacingScore) / 2;
}

/**
 * Calculate straightness: how straight the edges are
 * Returns 0-1 score where 1.0 is perfectly straight
 */
function calculateStraightness(cornerPoints: CornerPoints): number {
  // For now, assume edges are straight if they connect corner points
  // In a more advanced implementation, we could check for edge curvature
  // by sampling points along the edge and checking deviation from line
  
  const { topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner } = cornerPoints;
  
  // Calculate how parallel opposite edges are
  const topVector = { x: topRightCorner.x - topLeftCorner.x, y: topRightCorner.y - topLeftCorner.y };
  const bottomVector = { x: bottomRightCorner.x - bottomLeftCorner.x, y: bottomRightCorner.y - bottomLeftCorner.y };
  const leftVector = { x: topLeftCorner.x - bottomLeftCorner.x, y: topLeftCorner.y - bottomLeftCorner.y };
  const rightVector = { x: topRightCorner.x - bottomRightCorner.x, y: topRightCorner.y - bottomRightCorner.y };
  
  // Normalize vectors
  const topNorm = normalize(topVector);
  const bottomNorm = normalize(bottomVector);
  const leftNorm = normalize(leftVector);
  const rightNorm = normalize(rightVector);
  
  // Calculate dot products (1.0 means parallel, -1.0 means opposite)
  const horizontalParallel = Math.abs(dotProduct(topNorm, bottomNorm));
  const verticalParallel = Math.abs(dotProduct(leftNorm, rightNorm));
  
  return (horizontalParallel + verticalParallel) / 2;
}

/**
 * Calculate area of polygon defined by corner points using shoelace formula
 */
function calculatePolygonArea(cornerPoints: CornerPoints): number {
  const { topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner } = cornerPoints;
  const points = [topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner];
  
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  
  return Math.abs(area) / 2;
}

/**
 * Calculate Euclidean distance between two points
 */
function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Calculate angle at point B formed by points A-B-C
 * Returns angle in radians (0 to PI)
 */
function calculateAngle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
): number {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  
  const dot = ba.x * bc.x + ba.y * bc.y;
  const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y);
  const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y);
  
  const cos = dot / (magBA * magBC);
  return Math.acos(Math.max(-1, Math.min(1, cos)));
}

/**
 * Normalize a vector to unit length
 */
function normalize(v: { x: number; y: number }): { x: number; y: number } {
  const mag = Math.sqrt(v.x * v.x + v.y * v.y);
  if (mag === 0) return { x: 0, y: 0 };
  return { x: v.x / mag, y: v.y / mag };
}

/**
 * Calculate dot product of two vectors
 */
function dotProduct(v1: { x: number; y: number }, v2: { x: number; y: number }): number {
  return v1.x * v2.x + v1.y * v2.y;
}

/**
 * Check if confidence score meets minimum threshold
 */
export function isHighConfidence(
  metrics: ConfidenceMetrics,
  threshold: number = 0.85
): boolean {
  return metrics.overall >= threshold;
}

/**
 * Get human-readable confidence level
 */
export function getConfidenceLevel(confidence: number): string {
  if (confidence >= 0.9) return 'Excellent';
  if (confidence >= 0.8) return 'Good';
  if (confidence >= 0.7) return 'Fair';
  if (confidence >= 0.6) return 'Low';
  return 'Poor';
}

