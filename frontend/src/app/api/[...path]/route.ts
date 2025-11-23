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
  // Add trailing slash only for collection endpoints (e.g., /v1/jobs) to avoid FastAPI redirects.
  // Any path with more than two segments (e.g., /v1/jobs/{id}/image-url) should not get a trailing slash.
  const normalizedPath = path.replace(/\/+$/, '');
  const segments = normalizedPath ? normalizedPath.split('/') : [];
  const shouldAddTrailingSlash =
    normalizedPath.length > 0 &&
    !path.endsWith('/') &&
    segments.length === 2; // e.g., v1/jobs, v1/events
  const trailingSlash = shouldAddTrailingSlash ? '/' : '';
  const url = `http://backend:8000/api/${normalizedPath || path}${trailingSlash}${
    searchParams ? `?${searchParams}` : ''
  }`;

  try {
    // Forward all headers, especially Authorization for JWT tokens
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Forward Authorization header if present (for JWT authentication)
    const authHeader = request.headers.get('authorization');
    console.log(`[API Proxy] Forwarding request to backend: ${path}`);
    console.log(`[API Proxy] Authorization header present: ${!!authHeader}`);
    if (authHeader) {
      headers['Authorization'] = authHeader;
      console.log(`[API Proxy] Authorization header forwarded: ${authHeader.substring(0, 30)}...`);
    } else {
      console.warn(`[API Proxy] WARNING: No Authorization header found in request!`);
      console.log(`[API Proxy] All request headers:`, Object.fromEntries(request.headers.entries()));
    }
    
    // Forward other relevant headers
    const contentType = request.headers.get('content-type');
    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      let errorData: any;
      try {
        const errorText = await response.text();
        try {
          // Try to parse as JSON (FastAPI returns JSON errors)
          errorData = JSON.parse(errorText);
        } catch {
          // If not JSON, wrap in error object with 'detail' field (FastAPI format)
          errorData = { detail: errorText || 'Backend API error' };
        }
      } catch (error) {
        errorData = { detail: 'Failed to read error response' };
      }
      
      console.error(`Backend API error: ${response.status} ${response.statusText}`, errorData);
      // Return error in FastAPI format (with 'detail' field)
      return NextResponse.json(
        errorData,
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to proxy request';
    return NextResponse.json(
      { error: errorMessage, details: error instanceof Error ? error.stack : undefined },
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
    // Forward headers, especially Authorization for JWT tokens
    const headers: HeadersInit = {};
    
    // Forward Authorization header if present (for JWT authentication)
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    // Check if this is a file upload (multipart/form-data)
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // For file uploads, forward the FormData directly
      const formData = await request.formData();
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        let errorData: any;
        let errorText = '';
        try {
          errorText = await response.text();
          console.error(`Backend API error raw response:`, {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: errorText.substring(0, 500) // First 500 chars
          });
          
          try {
            // Try to parse as JSON (FastAPI returns JSON errors)
            errorData = JSON.parse(errorText);
          } catch (parseError) {
            // If not JSON, wrap in error object with 'detail' field (FastAPI format)
            errorData = { detail: errorText || 'Backend API error' };
          }
        } catch (error) {
          console.error('Failed to read error response:', error);
          errorData = { detail: 'Failed to read error response' };
        }
        
        console.error(`Backend API error parsed:`, errorData);
        // Return error in FastAPI format (with 'detail' field)
        return NextResponse.json(
          errorData,
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    } else {
      // For JSON requests, parse and forward as JSON
      headers['Content-Type'] = 'application/json';
      const body = await request.json();
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let errorData: any;
        let errorText = '';
        try {
          errorText = await response.text();
          console.error(`Backend API error raw response:`, {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: errorText.substring(0, 500) // First 500 chars
          });
          
          try {
            // Try to parse as JSON (FastAPI returns JSON errors)
            errorData = JSON.parse(errorText);
          } catch (parseError) {
            // If not JSON, wrap in error object with 'detail' field (FastAPI format)
            errorData = { detail: errorText || 'Backend API error' };
          }
        } catch (error) {
          console.error('Failed to read error response:', error);
          errorData = { detail: 'Failed to read error response' };
        }
        
        console.error(`Backend API error parsed:`, errorData);
        // Return error in FastAPI format (with 'detail' field)
        return NextResponse.json(
          errorData,
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }
  } catch (error) {
    console.error('Proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to proxy request';
    return NextResponse.json(
      { error: errorMessage, details: error instanceof Error ? error.stack : undefined },
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
    // Forward headers, especially Authorization for JWT tokens
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Forward Authorization header if present (for JWT authentication)
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(url, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      let errorData: any;
      try {
        const errorText = await response.text();
        try {
          // Try to parse as JSON (FastAPI returns JSON errors)
          errorData = JSON.parse(errorText);
        } catch {
          // If not JSON, wrap in error object with 'detail' field (FastAPI format)
          errorData = { detail: errorText || 'Backend API error' };
        }
      } catch (error) {
        errorData = { detail: 'Failed to read error response' };
      }
      
      console.error(`Backend API error: ${response.status} ${response.statusText}`, errorData);
      // Return error in FastAPI format (with 'detail' field)
      return NextResponse.json(
        errorData,
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to proxy request';
    return NextResponse.json(
      { error: errorMessage, details: error instanceof Error ? error.stack : undefined },
      { status: 500 }
    );
  }
}

