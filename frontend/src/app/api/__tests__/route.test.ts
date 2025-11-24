/**
 * Tests for API proxy route - ensuring trailing slashes are handled correctly
 * to prevent 307 redirects
 * 
 * Note: These tests verify the URL construction logic for the proxy route.
 * Full Next.js server component testing requires additional setup.
 */

// Mock fetch before any imports
global.fetch = jest.fn();

// Mock Next.js server components
jest.mock('next/server', () => ({
  NextRequest: class NextRequest {
    url: string;
    nextUrl: { searchParams: URLSearchParams; pathname: string };
    headers: Headers;
    
    constructor(url: string) {
      this.url = url;
      const urlObj = new URL(url);
      this.nextUrl = {
        searchParams: urlObj.searchParams,
        pathname: urlObj.pathname,
      };
      this.headers = new Headers();
    }
  },
  NextResponse: {
    json: (data: any, init?: ResponseInit & { status?: number }) => {
      // NextResponse.json accepts status in init object
      const status = (init as any)?.status || 200;
      const response = {
        json: async () => data,
        status,
        ok: status >= 200 && status < 300,
        headers: new Headers(init?.headers),
      };
      return response;
    },
  },
}));

import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from '../[...path]/route';

describe('API Proxy Route', () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('GET requests - trailing slash handling', () => {
    it('should add trailing slash to collection endpoints', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/v1/jobs?skip=0&limit=20');
      const params = { path: ['v1', 'jobs'] };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      } as Response);

      // Act
      await GET(request, { params });

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'http://backend:8000/api/v1/jobs/?skip=0&limit=20',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should not add trailing slash to UUID paths', async () => {
      // Arrange
      const uuid = '9eacbf72-4dcf-45d7-b599-3b7426277a64';
      const request = new NextRequest(`http://localhost:3000/api/v1/jobs/${uuid}`);
      const params = { path: ['v1', 'jobs', uuid] };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: uuid }),
      } as Response);

      // Act
      await GET(request, { params });

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        `http://backend:8000/api/v1/jobs/${uuid}`,
        expect.any(Object)
      );
      // Verify no trailing slash was added
      const callUrl = (mockFetch.mock.calls[0][0] as string);
      expect(callUrl).not.toMatch(/\/$/);
    });

    it('should not add trailing slash if already present', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/v1/jobs/');
      const params = { path: ['v1', 'jobs', ''] };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      } as Response);

      // Act
      await GET(request, { params });

      // Assert
      const callUrl = (mockFetch.mock.calls[0][0] as string);
      // Should only have one trailing slash
      const trailingSlashes = (callUrl.match(/\/+$/)?.[0] || '').length;
      expect(trailingSlashes).toBeLessThanOrEqual(1);
    });

    it('should handle paths with query parameters correctly', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/v1/jobs?skip=0&limit=20&email=test@example.com');
      const params = { path: ['v1', 'jobs'] };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      } as Response);

      // Act
      await GET(request, { params });

      // Assert
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('/api/v1/jobs/?');
      expect(callUrl).toContain('skip=0');
      expect(callUrl).toContain('limit=20');
      // Email is URL-encoded in query strings
      expect(callUrl).toContain('email=test%40example.com');
    });

    it('should handle nested collection paths', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/v1/jobs/123/restore');
      const params = { path: ['v1', 'jobs', '123', 'restore'] };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'restore-123' }),
      } as Response);

      // Act
      await GET(request, { params });

      // Assert
      // Should not add trailing slash for nested paths that don't end with UUID
      const callUrl = mockFetch.mock.calls[0][0] as string;
      // This is a nested resource, so behavior may vary, but should not cause 307
      expect(callUrl).toContain('/api/v1/jobs/123/restore');
    });
  });

  describe('POST requests', () => {
    it('should not add trailing slash to POST endpoints', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/v1/jobs/upload', {
        method: 'POST',
        body: new FormData(),
      });
      const params = { path: ['v1', 'jobs', 'upload'] };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ job_id: '123' }),
      } as Response);

      // Act
      await POST(request, { params });

      // Assert
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toBe('http://backend:8000/api/v1/jobs/upload');
      expect(callUrl).not.toMatch(/\/$/);
    });
  });

  describe('DELETE requests', () => {
    it('should not add trailing slash to DELETE endpoints', async () => {
      // Arrange
      const uuid = '9eacbf72-4dcf-45d7-b599-3b7426277a64';
      const request = new NextRequest(`http://localhost:3000/api/v1/jobs/${uuid}`, {
        method: 'DELETE',
      });
      const params = { path: ['v1', 'jobs', uuid] };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'deleted' }),
      } as Response);

      // Act
      await DELETE(request, { params });

      // Assert
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toBe(`http://backend:8000/api/v1/jobs/${uuid}`);
      expect(callUrl).not.toMatch(/\/$/);
    });
  });

  describe('Error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/v1/jobs');
      const params = { path: ['v1', 'jobs'] };

      // Mock fetch to throw an error (simulating network failure)
      mockFetch.mockImplementationOnce(() => {
        throw new Error('Network error');
      });

      // Act
      const response = await GET(request, { params });

      // Assert
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to proxy request');
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should preserve response status codes', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/v1/jobs/999');
      const params = { path: ['v1', 'jobs', '999'] };

      // Mock a successful fetch that returns 404 status
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      } as Response);

      // Act
      const response = await GET(request, { params });

      // Assert
      // The route should preserve the status code from the fetch response
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Not found');
    });
  });
});

