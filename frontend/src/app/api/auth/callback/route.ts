/**
 * Supabase Auth Callback Handler
 * 
 * This route handles OAuth callbacks from Supabase authentication providers.
 * After successful authentication, Supabase redirects here with an auth code.
 * We exchange the code for a session and set cookies.
 * For new users, checks if they've accepted terms and redirects to terms acceptance if needed.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Log immediately to verify route is being hit
  console.log('=== API CALLBACK ROUTE HIT ===');
  console.log('Request URL:', request.url);
  
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const error = requestUrl.searchParams.get('error');
    const next = requestUrl.searchParams.get('next') || '/upload';

    console.log('API callback route called:', { code: code ? 'present' : 'missing', error, next });

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(error)}`, requestUrl.origin));
    }

    if (!code) {
      console.log('No code parameter, redirecting to sign-in');
      return NextResponse.redirect(new URL('/sign-in', requestUrl.origin));
    }

    const cookieStore = await cookies();
    
    // Get Supabase URL and normalize for server-side use
    let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase configuration');
      return NextResponse.redirect(new URL('/sign-in?error=Missing Supabase configuration', requestUrl.origin));
    }

    // For server-side, we can use host.docker.internal if needed
    // But for local Supabase, we should use localhost
    supabaseUrl = supabaseUrl.replace(/host\.docker\.internal/g, '127.0.0.1');

    console.log('Creating Supabase client with URL:', supabaseUrl.replace(/\/\/.*@/, '//***@'));

    // Create a Supabase client for server-side operations
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {
              // The `set` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
              console.warn('Cookie set warning:', error);
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {
              // The `delete` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
              console.warn('Cookie remove warning:', error);
            }
          },
        },
      }
    );

    console.log('Exchanging code for session...');
    // Exchange the code for a session
    const { error: exchangeError, data } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('Error exchanging code for session:', exchangeError);
      // Redirect to sign-in page with error
      return NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(exchangeError.message)}`, requestUrl.origin));
    }

    console.log('Code exchanged successfully, user:', data?.user?.id);

    // Check if user has accepted terms
    const user = data?.user;
    const hasAcceptedTerms = user?.user_metadata?.accepted_terms === true;

    if (!hasAcceptedTerms) {
      // New user hasn't accepted terms - redirect to terms acceptance page
      // Preserve the original redirect destination
      const redirectTo = next !== '/upload' ? `?next=${encodeURIComponent(next)}` : '';
      console.log('User has not accepted terms, redirecting to accept-terms');
      return NextResponse.redirect(new URL(`/auth/accept-terms${redirectTo}`, requestUrl.origin));
    }

    // User has accepted terms - redirect to intended destination
    console.log('User authenticated, redirecting to:', next);
    return NextResponse.redirect(new URL(next, requestUrl.origin));
  } catch (err) {
    console.error('Unexpected error in API callback route:', err);
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
    return NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(errorMessage)}`, request.url));
  }
}

