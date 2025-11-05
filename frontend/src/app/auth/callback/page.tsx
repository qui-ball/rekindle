'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

/**
 * OAuth Callback Page
 * 
 * Handles OAuth callbacks from Supabase authentication providers.
 * This client-side route processes the OAuth callback and redirects appropriately.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams?.get('code');
      const error = searchParams?.get('error');
      const next = searchParams?.get('next') || '/dashboard';

      if (error) {
        // OAuth error occurred
        router.push(`/sign-in?error=${encodeURIComponent(error)}`);
        return;
      }

      if (code) {
        // Create Supabase client
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
          router.push('/sign-in?error=Missing Supabase configuration');
          return;
        }

        const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

        // Exchange code for session
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          router.push(`/sign-in?error=${encodeURIComponent(exchangeError.message)}`);
          return;
        }

        // Success - redirect to intended destination
        router.push(next);
      } else {
        // No code - redirect to sign-in
        router.push('/sign-in');
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

