/**
 * Next.js Middleware for Route Protection
 * 
 * This middleware protects authenticated routes by checking Supabase session.
 * It uses the Supabase SSR package to create a middleware client that works
 * in the Edge Runtime environment.
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

import { createMiddlewareClient } from '@supabase/ssr';
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
  // Create a response object to modify
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create Supabase client for middleware
  // createMiddlewareClient reads from NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
  // These environment variables are available in Edge Runtime
  const supabase = createMiddlewareClient({ req: request, res: response });

  // Refresh session if expired (Supabase will handle this automatically)
  // This ensures the session is up-to-date before checking authentication
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // If no session, redirect to sign-in with return URL
  if (!session) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('next', pathname); // Preserve the intended destination
    return NextResponse.redirect(signInUrl);
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

