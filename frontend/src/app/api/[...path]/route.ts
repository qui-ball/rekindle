import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  
  // Skip proxying for auth/callback - it's handled by its own route
  if (path === 'auth/callback') {
    console.log('Catch-all route: Skipping auth/callback (handled by dedicated route)');
    return NextResponse.json(
      { error: 'This route should be handled by /api/auth/callback' },
      { status: 404 }
    );
  }
  
  const searchParams = request.nextUrl.searchParams.toString();
  // Add trailing slash for collection endpoints to avoid 307 redirects from FastAPI
  // FastAPI automatically redirects /api/v1/jobs to /api/v1/jobs/ when route is defined with "/"
  // Only add trailing slash if path doesn't already have one and doesn't end with a UUID
  const hasTrailingSlash = path.endsWith('/');
  const isUuidPath = path.match(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  const trailingSlash = (!hasTrailingSlash && !isUuidPath && path) ? '/' : '';
  const url = `http://backend:8000/api/${path}${trailingSlash}${searchParams ? `?${searchParams}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  const url = `http://backend:8000/api/${path}`;

  try {
    // Check if this is a file upload (multipart/form-data)
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // For file uploads, forward the FormData directly
      const formData = await request.formData();
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    } else {
      // For JSON requests, parse and forward as JSON
      const body = await request.json();
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  const url = `http://backend:8000/api/${path}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request' },
      { status: 500 }
    );
  }
}

