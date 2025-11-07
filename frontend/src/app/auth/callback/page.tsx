'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/contexts/AuthContext';

/**
 * OAuth Callback Page
 * 
 * Handles OAuth callbacks from Supabase authentication providers.
 * This client-side route processes the OAuth callback and redirects appropriately.
 * For new users, checks if they've accepted terms and redirects to terms acceptance if needed.
 */
function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check if we're on 127.0.0.1 but should be on a different hostname (mobile access)
        // Supabase might redirect to site_url (127.0.0.1) instead of the actual hostname
        const currentHostname = window.location.hostname;
        
        // If we're on 127.0.0.1 but the original hostname was different (mobile access),
        // redirect to the original hostname to preserve the OAuth flow
        if (currentHostname === '127.0.0.1' && typeof window !== 'undefined') {
          const originalHostname = sessionStorage.getItem('oauth_original_hostname');
          const originalOrigin = sessionStorage.getItem('oauth_original_origin');
          
          // If we have a stored original hostname and it's different from 127.0.0.1, redirect to it
          if (originalHostname && originalHostname !== '127.0.0.1' && originalHostname !== currentHostname) {
            const currentUrl = new URL(window.location.href);
            currentUrl.hostname = originalHostname;
            // Use the original origin's protocol and port if available
            if (originalOrigin) {
              try {
                const originUrl = new URL(originalOrigin);
                currentUrl.protocol = originUrl.protocol;
                currentUrl.port = originUrl.port;
              } catch (e) {
                // Ignore URL parsing errors
              }
            }
            console.log('Redirecting from 127.0.0.1 to original hostname:', originalHostname);
            window.location.replace(currentUrl.toString());
            return;
          }
        }
        
        // Get URL params directly from window.location as fallback
        const urlParams = new URLSearchParams(window.location.search);
        const code = searchParams?.get('code') || urlParams.get('code');
        const error = searchParams?.get('error') || urlParams.get('error');
        const next = searchParams?.get('next') || urlParams.get('next') || '/upload';

        if (error) {
          // OAuth error occurred
          console.error('OAuth error:', error);
          router.push(`/sign-in?error=${encodeURIComponent(error)}`);
          return;
        }

        if (!code) {
          // No code - redirect to sign-in
          console.log('No code in callback, redirecting to sign-in');
          router.push('/sign-in');
          return;
        }

        // Use the same Supabase client instance as AuthContext to ensure consistency
        // This is critical for PKCE - the cookie key is based on the Supabase URL hostname
        // Both OAuth initiation and callback must use the exact same URL normalization
        const supabase = getSupabaseClient();
        
        // Check if we already have a session (the code might have been exchanged already)
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession) {
          // User is already authenticated, redirect to intended destination
          const user = existingSession.user;
          const hasAcceptedTerms = user?.user_metadata?.accepted_terms === true;

          if (!hasAcceptedTerms) {
            const redirectTo = next !== '/upload' ? `?next=${encodeURIComponent(next)}` : '';
            router.push(`/auth/accept-terms${redirectTo}`);
            return;
          }

          router.push(next);
          return;
        }

        // Exchange code for session - PKCE code verifier should be read from cookies automatically
        // The code verifier was stored when signInWithOAuth was called
        // Important: The protocol (HTTP/HTTPS) must match between OAuth initiation and callback
        // If this fails, it means the code verifier cookie isn't accessible (domain/path/protocol issue)
        // Note: createBrowserClient should automatically read the code verifier from HttpOnly cookies
        const { error: exchangeError, data } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          console.error('Error exchanging code for session:', exchangeError);
          router.push(`/sign-in?error=${encodeURIComponent(exchangeError.message)}`);
          return;
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
          router.push(`/auth/accept-terms${redirectTo}`);
          return;
        }

        // User has accepted terms - redirect to intended destination
        console.log('User authenticated, redirecting to:', next);
        router.push(next);
      } catch (err) {
        console.error('Unexpected error in callback:', err);
        router.push(`/sign-in?error=${encodeURIComponent('An unexpected error occurred during authentication')}`);
      }
    };

    handleCallback();
  }, [router, searchParams]);

  // Show loading state while processing callback
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
