/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { middleware } from '../middleware';
import { createServerClient } from '@supabase/ssr';

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}));

const mockedCreateServerClient = createServerClient as jest.Mock;

describe('authentication middleware', () => {
  const env = process.env;

  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  afterAll(() => {
    process.env = env;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('redirects unauthenticated users from protected routes', async () => {
    mockedCreateServerClient.mockReturnValueOnce({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
      },
    });

    const request = new NextRequest('http://localhost/upload');
    const response = await middleware(request);

    expect(mockedCreateServerClient).toHaveBeenCalled();
    expect(response.headers.get('location')).toBe('http://localhost/sign-in?next=%2Fupload');
  });

  it('allows authenticated users through protected routes', async () => {
    mockedCreateServerClient.mockReturnValueOnce({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: 'user-123' },
              access_token: 'eyJ.mock.token',
            },
          },
          error: null,
        }),
      },
    });

    const request = new NextRequest('http://localhost/gallery');
    const response = await middleware(request);

    expect(response.headers.get('location')).toBeNull();
  });
});

