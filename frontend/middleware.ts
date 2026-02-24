/**
 * Next.js Middleware for Route Protection
 * 
 * This middleware protects authenticated routes by checking Supabase session.
 * It uses createServerClient from @supabase/ssr with cookie getAll/setAll for Edge Runtime.
 * 
 * Protected Routes:
 * - /dashboard/*
 * - /photos/*
 * - /settings/*
 * 
 * Public Routes (always accessible):
 * - / (landing page)
 * - /sign-in
 * - /sign-up
 * - /auth/callback
 * - /api/*
 * - /subscription (public subscription page)
 * 
 * Protected Routes (require authentication):
 * - /upload (photo upload page)
 * - /gallery (user's photo gallery)
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Get the current pathname
  const pathname = request.nextUrl.pathname;

  // Define public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/sign-in',
    '/sign-up',
    '/auth/callback',
    '/subscription',
  ];

  // Define protected route patterns
  const protectedRoutePatterns = [
    /^\/upload(\/.*)?$/,      // /upload and /upload/*
    /^\/gallery(\/.*)?$/,     // /gallery and /gallery/*
    /^\/dashboard(\/.*)?$/,   // /dashboard and /dashboard/*
    /^\/photos(\/.*)?$/,      // /photos and /photos/*
    /^\/settings(\/.*)?$/,     // /settings and /settings/*
  ];

  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutePatterns.some((pattern) =>
    pattern.test(pathname)
  );

  // Check if the current path is a public route
  const isPublicRoute = publicRoutes.some((route) => pathname === route);

  // Allow API routes to pass through (they handle their own auth)
  const isApiRoute = pathname.startsWith('/api/');

  // If it's an API route, allow it through immediately
  if (isApiRoute) {
    return NextResponse.next();
  }

  // If it's a public route, allow it through immediately
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // If it's not a protected route, allow it through immediately
  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // At this point, we know it's a protected route
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  // If no session or session error, redirect to sign-in with return URL
  // But only if not already going to sign-in (prevent redirect loops)
  if (!session || sessionError) {
    // Don't redirect if already on sign-in page
    if (pathname !== '/sign-in' && !pathname.startsWith('/sign-in')) {
      const signInUrl = new URL('/sign-in', request.url);
      signInUrl.searchParams.set('next', pathname); // Preserve the intended destination
      return NextResponse.redirect(signInUrl);
    }
    // If already on sign-in, allow through
    return NextResponse.next();
  }
  
  // Check if session has a valid access token
  if (!session.access_token) {
    // Session exists but no token - redirect to sign-in
    if (pathname !== '/sign-in' && !pathname.startsWith('/sign-in')) {
      const signInUrl = new URL('/sign-in', request.url);
      signInUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(signInUrl);
    }
    return NextResponse.next();
  }

  // User is authenticated, allow access to protected route
  return response;
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (public assets)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};

