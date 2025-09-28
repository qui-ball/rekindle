// Tests for OpenCV loader service
import { OpenCVLoader } from '../opencvLoader';

describe('OpenCVLoader', () => {
  let loader: OpenCVLoader;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset window.cv
    delete (window as Window & { cv?: unknown }).cv;
    // Create fresh instance for each test
    loader = new OpenCVLoader();
  });

  describe('isReady', () => {
    it('should return false when OpenCV is not loaded', () => {
      expect(loader.isReady()).toBe(false);
    });

    it('should check for OpenCV availability', () => {
      // Test that the method exists and returns a boolean
      const result = loader.isReady();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getOpenCV', () => {
    it('should throw error when OpenCV is not ready', () => {
      expect(() => loader.getOpenCV()).toThrow('OpenCV.js is not loaded');
    });

    it('should have getOpenCV method', () => {
      expect(typeof loader.getOpenCV).toBe('function');
    });
  });

  describe('basic functionality', () => {
    it('should be instantiable', () => {
      expect(loader).toBeInstanceOf(OpenCVLoader);
    });

    it('should have loadOpenCV method', () => {
      expect(typeof loader.loadOpenCV).toBe('function');
    });
  });
});