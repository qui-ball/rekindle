import { PhotoDetector } from './PhotoDetector';

// Mock canvas and image for testing
const mockCanvas = {
  width: 0,
  height: 0,
  getContext: jest.fn(() => ({
    drawImage: jest.fn(),
    getImageData: jest.fn(() => ({
      data: new Uint8ClampedArray(800 * 600 * 4).fill(128), // Gray image
      width: 800,
      height: 600
    }))
  }))
};

const mockImage = {
  crossOrigin: '',
  onload: null as (() => void) | null,
  onerror: null as (() => void) | null,
  src: '',
  naturalWidth: 800,
  naturalHeight: 600
};

// Mock DOM methods
global.document.createElement = jest.fn((tagName: string) => {
  if (tagName === 'canvas') {
    return mockCanvas as any;
  }
  return document.createElement(tagName);
});

global.Image = jest.fn(() => mockImage) as any;

describe('PhotoDetector', () => {
  let photoDetector: PhotoDetector;

  beforeEach(() => {
    jest.clearAllMocks();
    photoDetector = new PhotoDetector();
  });

  afterEach(() => {
    photoDetector.dispose();
  });

  it('should create PhotoDetector instance', () => {
    expect(photoDetector).toBeInstanceOf(PhotoDetector);
  });

  it('should return generic crop area when no photo is detected', async () => {
    const imageData = 'data:image/jpeg;base64,testImageData';
    const imageWidth = 800;
    const imageHeight = 600;

    const detectionPromise = photoDetector.detectPhotoBoundaries(imageData, imageWidth, imageHeight);
    
    // Simulate image load
    if (mockImage.onload) {
      mockImage.onload();
    }

    const result = await detectionPromise;

    expect(result.detected).toBe(false);
    expect(result.confidence).toBe(0.5);
    expect(result.cropArea).toEqual({
      x: Math.round(imageWidth * 0.1),
      y: Math.round(imageHeight * 0.1),
      width: Math.round(imageWidth * 0.8),
      height: Math.round(imageHeight * 0.8)
    });
  });

  it('should handle image load error gracefully', async () => {
    const imageData = 'invalid-image-data';
    const imageWidth = 800;
    const imageHeight = 600;

    const detectionPromise = photoDetector.detectPhotoBoundaries(imageData, imageWidth, imageHeight);
    
    // Simulate image error
    if (mockImage.onerror) {
      mockImage.onerror();
    }

    const result = await detectionPromise;

    expect(result.detected).toBe(false);
    expect(result.confidence).toBe(0.5);
    expect(result.cropArea).toEqual({
      x: Math.round(imageWidth * 0.1),
      y: Math.round(imageHeight * 0.1),
      width: Math.round(imageWidth * 0.8),
      height: Math.round(imageHeight * 0.8)
    });
  });

  it('should return crop area with correct dimensions', async () => {
    const imageData = 'data:image/jpeg;base64,testImageData';
    const imageWidth = 1000;
    const imageHeight = 800;

    const detectionPromise = photoDetector.detectPhotoBoundaries(imageData, imageWidth, imageHeight);
    
    // Simulate image load
    if (mockImage.onload) {
      mockImage.naturalWidth = imageWidth;
      mockImage.naturalHeight = imageHeight;
      mockImage.onload();
    }

    const result = await detectionPromise;

    expect(result.cropArea.x).toBeGreaterThanOrEqual(0);
    expect(result.cropArea.y).toBeGreaterThanOrEqual(0);
    expect(result.cropArea.width).toBeGreaterThan(0);
    expect(result.cropArea.height).toBeGreaterThan(0);
    expect(result.cropArea.x + result.cropArea.width).toBeLessThanOrEqual(imageWidth);
    expect(result.cropArea.y + result.cropArea.height).toBeLessThanOrEqual(imageHeight);
  });

  it('should dispose resources properly', () => {
    expect(() => photoDetector.dispose()).not.toThrow();
  });

  it('should handle processing errors gracefully', async () => {
    // Create a new detector with mocked error
    const originalGetContext = mockCanvas.getContext;
    mockCanvas.getContext = jest.fn(() => {
      throw new Error('Canvas error');
    });

    let errorDetector: PhotoDetector;
    try {
      errorDetector = new PhotoDetector();
    } catch {
      // Expected to fail, create a mock detector for testing
      errorDetector = photoDetector;
    }

    // Restore the original mock
    mockCanvas.getContext = originalGetContext;

    const imageData = 'data:image/jpeg;base64,testImageData';
    const imageWidth = 800;
    const imageHeight = 600;

    const detectionPromise = errorDetector.detectPhotoBoundaries(imageData, imageWidth, imageHeight);
    
    // Simulate image load
    if (mockImage.onload) {
      mockImage.onload();
    }

    const result = await detectionPromise;

    // Should fallback to generic crop area
    expect(result.detected).toBe(false);
    expect(result.confidence).toBe(0.5);
  });
});