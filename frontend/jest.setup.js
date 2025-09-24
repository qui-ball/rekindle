import '@testing-library/jest-dom';

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock MediaDevices for camera testing
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }],
    }),
    enumerateDevices: jest.fn().mockResolvedValue([]),
  },
});

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn().mockReturnValue('mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock File and FileReader
global.File = class MockFile {
  constructor(parts, filename, properties) {
    this.parts = parts;
    this.name = filename;
    this.size = properties?.size || 0;
    this.type = properties?.type || '';
  }
};

global.FileReader = class MockFileReader {
  constructor() {
    this.readAsDataURL = jest.fn();
    this.readAsArrayBuffer = jest.fn();
    this.result = null;
    this.onload = null;
    this.onerror = null;
  }
};