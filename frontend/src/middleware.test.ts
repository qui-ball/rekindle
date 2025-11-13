/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { middleware } from './middleware';
import { createMiddlewareClient } from '@supabase/ssr';

jest.mock('@supabase/ssr', () => ({
  createMiddlewareClient: jest.fn(),
}));

const mockedCreateMiddlewareClient = createMiddlewareClient as jest.Mock;

describe('authentication middleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('redirects unauthenticated users from protected routes', async () => {
    mockedCreateMiddlewareClient.mockReturnValueOnce({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: null },
        }),
      },
    });

    const request = new NextRequest('http://localhost/upload');
    const response = await middleware(request);

    expect(mockedCreateMiddlewareClient).toHaveBeenCalled();
    expect(response.headers.get('location')).toBe('http://localhost/sign-in?next=%2Fupload');
  });

  it('allows authenticated users through protected routes', async () => {
    mockedCreateMiddlewareClient.mockReturnValueOnce({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-123' } } },
        }),
      },
    });

    const request = new NextRequest('http://localhost/gallery');
    const response = await middleware(request);

    expect(response.headers.get('location')).toBeNull();
  });
});

