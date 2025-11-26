/**
 * Supabase Auth Callback Handler
 * 
 * This route handles OAuth callbacks from Supabase authentication providers.
 * After successful authentication, Supabase redirects here with an auth code.
 * We exchange the code for a session and set cookies.
 * For new users, checks if they've accepted terms and redirects to terms acceptance if needed.
 */

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';

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
    const supabase = createSupabaseServerClient({
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch (error) {
          console.warn('Cookie set warning:', error);
        }
      },
      remove(name: string, options: any) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch (error) {
          console.warn('Cookie remove warning:', error);
        }
      },
    });

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

