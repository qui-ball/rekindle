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
    this.result = null;
    this.onload = null;
    this.onerror = null;
  }
  
  readAsDataURL(file) {
    setTimeout(() => {
      this.result = 'data:image/jpeg;base64,mock-data';
      if (this.onload) this.onload();
    }, 0);
  }
  
  readAsArrayBuffer(file) {
    setTimeout(() => {
      this.result = new ArrayBuffer(8);
      if (this.onload) this.onload();
    }, 0);
  }
};

// Mock Worker for heic2any library
global.Worker = class MockWorker {
  constructor(url) {
    this.url = url;
    this.onmessage = null;
    this.onerror = null;
  }
  
  postMessage(data) {
    // Mock worker behavior
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({ data: 'mock-result' });
      }
    }, 0);
  }
  
  terminate() {}
};

// Mock Canvas and CanvasRenderingContext2D for PhotoDetector
global.HTMLCanvasElement.prototype.getContext = jest.fn((contextType) => {
  if (contextType === '2d') {
    return {
      drawImage: jest.fn(),
      getImageData: jest.fn(() => ({
        data: new Uint8ClampedArray(4), // Mock image data
        width: 1,
        height: 1
      })),
      putImageData: jest.fn(),
      createImageData: jest.fn(() => ({
        data: new Uint8ClampedArray(4),
        width: 1,
        height: 1
      })),
      canvas: {
        width: 100,
        height: 100,
        toDataURL: jest.fn(() => 'data:image/png;base64,mock-canvas-data')
      }
    };
  }
  return null;
});

// Mock canvas toDataURL method
global.HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/png;base64,mock-canvas-data');