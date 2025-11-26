import '@testing-library/jest-dom';

// Mock window.matchMedia (only if window exists - node environment tests don't have it)
if (typeof window !== 'undefined') {
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
}

// Mock screen.orientation for PWA tests (only if screen exists)
if (typeof screen !== 'undefined') {
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
}

// Mock window.orientation for older browsers (only if window exists)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'orientation', {
  writable: true,
  value: 0,
  });
}

// Mock document.referrer for PWA detection (only if document exists)
if (typeof document !== 'undefined') {
  Object.defineProperty(document, 'referrer', {
  writable: true,
  value: '',
  });
}

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

// Mock MediaDevices for camera testing (only if navigator exists)
if (typeof navigator !== 'undefined') {
  Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }],
    }),
    enumerateDevices: jest.fn().mockResolvedValue([]),
  },
  });
}

// Mock URL.createObjectURL (only if URL exists)
if (typeof URL !== 'undefined') {
  URL.createObjectURL = jest.fn().mockReturnValue('mock-url');
  URL.revokeObjectURL = jest.fn();
}

// Mock File and FileReader (only if not in node environment)
if (typeof File === 'undefined') {
  global.File = class MockFile {
    constructor(parts, filename, properties) {
      this.parts = parts;
      this.name = filename;
      this.size = properties?.size || 0;
      this.type = properties?.type || '';
    }
  };
}

if (typeof FileReader === 'undefined') {
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
}

// Mock Worker for heic2any library (only if Worker doesn't exist)
if (typeof Worker === 'undefined') {
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
}

// Mock Canvas and CanvasRenderingContext2D for SmartPhotoDetector and camera capture (only if HTMLCanvasElement exists)
if (typeof HTMLCanvasElement !== 'undefined' && HTMLCanvasElement.prototype) {
  HTMLCanvasElement.prototype.getContext = jest.fn((contextType) => {
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
  HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/png;base64,mock-canvas-data');
}

// Mock TextEncoder/TextDecoder for JScanify (only if they don't exist)
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = class TextEncoder {
    encode(input) {
      return new Uint8Array(Buffer.from(input, 'utf8'));
    }
  };
}

if (typeof TextDecoder === 'undefined') {
  global.TextDecoder = class TextDecoder {
    decode(input) {
      return Buffer.from(input).toString('utf8');
    }
  };
}

// Mock JScanify module
jest.mock('jscanify', () => {
  return jest.fn().mockImplementation(() => ({
    findPaperContour: jest.fn(),
    getCornerPoints: jest.fn(),
    extractPaper: jest.fn()
  }));
});

// Mock OpenCV for JScanify (only if cv doesn't exist)
if (typeof global.cv === 'undefined') {
  global.cv = {
  Mat: jest.fn(),
  imread: jest.fn(() => ({
    delete: jest.fn()
  })),
  imshow: jest.fn(),
  waitKey: jest.fn()
  };
}

// Set up Supabase environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';

// Supabase client mocks for browser components
const createMockQueryBuilder = () => {
  const builder = {
    select: jest.fn(function () { return this; }),
    insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    update: jest.fn().mockResolvedValue({ data: null, error: null }),
    upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
    delete: jest.fn().mockResolvedValue({ data: null, error: null }),
    eq: jest.fn(function () { return this; }),
    neq: jest.fn(function () { return this; }),
    order: jest.fn(function () { return this; }),
    limit: jest.fn(function () { return this; }),
    range: jest.fn(function () { return this; }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  return builder;
};

const baseSupabaseSession = {
  access_token: 'eyJ.mock.access.token',
  refresh_token: 'mock-refresh-token',
  token_type: 'bearer',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
  },
};

let currentSupabaseSession = { ...baseSupabaseSession, user: { ...baseSupabaseSession.user } };

const setSupabaseSession = (overrides = {}) => {
  const userOverrides = overrides.user || {};
  currentSupabaseSession = {
    ...currentSupabaseSession,
    ...overrides,
    user: {
      ...currentSupabaseSession.user,
      ...userOverrides,
    },
  };
};

const resetSupabaseSession = () => {
  currentSupabaseSession = {
    ...baseSupabaseSession,
    user: { ...baseSupabaseSession.user },
  };
};

const createMockSupabaseClient = () => {
  const auth = {
    getSession: jest.fn(async () => ({
      data: { session: currentSupabaseSession },
      error: null,
    })),
    refreshSession: jest.fn(async () => ({
      data: { session: currentSupabaseSession },
      error: null,
    })),
    getUser: jest.fn(async () => ({
      data: { user: currentSupabaseSession.user },
      error: null,
    })),
    signOut: jest.fn(async () => ({ error: null })),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
  };

  const storageBucketApi = {
    upload: jest.fn().mockResolvedValue({ data: { Key: 'mock-key' }, error: null }),
    download: jest.fn().mockResolvedValue({ data: new ArrayBuffer(8), error: null }),
    remove: jest.fn().mockResolvedValue({ data: null, error: null }),
    list: jest.fn().mockResolvedValue({ data: [], error: null }),
  };

  const storage = {
    from: jest.fn(() => storageBucketApi),
  };

  return {
    auth,
    from: jest.fn(() => createMockQueryBuilder()),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    storage,
  };
};

const mockSupabaseClient = createMockSupabaseClient();

jest.mock('@/lib/supabase', () => {
  const actual = jest.requireActual('@/lib/supabase');

  return {
    ...actual,
    getSupabaseClient: jest.fn(() => mockSupabaseClient),
    __supabaseTestUtils: {
      client: mockSupabaseClient,
      auth: mockSupabaseClient.auth,
      setSession: setSupabaseSession,
      resetSession: resetSupabaseSession,
    },
  };
});