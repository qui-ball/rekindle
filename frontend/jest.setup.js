import '@testing-library/jest-dom';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock screen.orientation for PWA tests
Object.defineProperty(screen, 'orientation', {
  writable: true,
  value: {
    angle: 0,
    type: 'portrait-primary',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    lock: jest.fn().mockResolvedValue(undefined),
    unlock: jest.fn(),
  },
});

// Mock window.orientation for older browsers
Object.defineProperty(window, 'orientation', {
  writable: true,
  value: 0,
});

// Mock document.referrer for PWA detection
Object.defineProperty(document, 'referrer', {
  writable: true,
  value: '',
});

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

// Mock Canvas and CanvasRenderingContext2D for SmartPhotoDetector and camera capture
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

// Mock TextEncoder/TextDecoder for JScanify
global.TextEncoder = class TextEncoder {
  encode(input) {
    return new Uint8Array(Buffer.from(input, 'utf8'));
  }
};

global.TextDecoder = class TextDecoder {
  decode(input) {
    return Buffer.from(input).toString('utf8');
  }
};

// Mock JScanify module
jest.mock('jscanify', () => {
  return jest.fn().mockImplementation(() => ({
    findPaperContour: jest.fn(),
    getCornerPoints: jest.fn(),
    extractPaper: jest.fn()
  }));
});

// Mock OpenCV for JScanify
global.cv = {
  Mat: jest.fn(),
  imread: jest.fn(() => ({
    delete: jest.fn()
  })),
  imshow: jest.fn(),
  waitKey: jest.fn()
};