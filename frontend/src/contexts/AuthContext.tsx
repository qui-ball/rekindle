/**
 * Supabase Authentication Context
 * 
 * Provides authentication state and methods throughout the application.
 * Uses Supabase for authentication with automatic session management.
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { User, Session } from '@supabase/supabase-js';

// Type for auth errors - Supabase returns error objects with this structure
type AuthError = {
  message: string;
  status?: number;
};

// Types for the auth context
export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: AuthError | null;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, metadata?: Record<string, any>) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  signInWithOAuth: (provider: 'google' | 'facebook' | 'apple') => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  refreshSession: () => Promise<void>;
  acceptTerms: () => Promise<{ error: AuthError | null }>;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Supabase client instance and normalized URL
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null;
let currentNormalizedUrl: string | null = null;

/**
 * Normalize Supabase URL for client-side use
 * 
 * In Docker development, the URL may be set to `http://host.docker.internal:54321`
 * for server-side code, but browsers can't resolve `host.docker.internal`.
 * This function replaces it with the appropriate hostname for browser use:
 * - If accessed via IP address (mobile), use the same IP
 * - Otherwise, use localhost
 * 
 * Note: This is a client-side module ('use client'), so we always normalize the URL.
 */
function normalizeSupabaseUrl(url: string): string {
  // Check if we're accessing via IP address (mobile device)
  const isIPAddress = typeof window !== 'undefined' && 
    /^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname);
  
  if (isIPAddress) {
    // Replace host.docker.internal with the current hostname (IP address)
    // This allows mobile devices to access Supabase
    const hostname = window.location.hostname;
    return url.replace(/host\.docker\.internal/g, hostname);
  }
  
  // Replace host.docker.internal with localhost for browser access
  // Browsers can't resolve host.docker.internal, so we use localhost instead
  return url.replace(/host\.docker\.internal/g, 'localhost');
}

// Export getSupabaseClient so it can be used in other components (like OAuth callback)
// This ensures the same client instance and URL normalization is used throughout
// Note: The client is recreated if the hostname changes (e.g., localhost vs IP address)
export const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    );
  }

  // Normalize URL for browser use - this is critical for PKCE
  // The cookie key is based on the hostname in the URL
  // Both OAuth initiation and callback must use the exact same normalized URL
  const normalizedUrl = normalizeSupabaseUrl(supabaseUrl);
  
  // Recreate client if URL changed (e.g., switching from localhost to IP or vice versa)
  // This is important for mobile access where the hostname is different
  if (!supabaseClient || currentNormalizedUrl !== normalizedUrl) {
    supabaseClient = createBrowserClient(normalizedUrl, supabaseAnonKey);
    currentNormalizedUrl = normalizedUrl;
  }
  
  return supabaseClient;
};

// AuthProvider component
interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<AuthError | null>(null);

  // Initialize Supabase client
  const supabase = getSupabaseClient();

  // Get current session and user
  const getSession = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Error getting session:', sessionError);
        setError(sessionError);
        setSession(null);
        setUser(null);
        return;
      }

      setSession(currentSession);
      setUser(currentSession?.user ?? null);
    } catch (err) {
      console.error('Unexpected error getting session:', err);
      setError(err as AuthError);
      setSession(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Initialize auth state on mount
  useEffect(() => {
    getSession();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      setError(null);
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, getSession]);

  // Sign in with email and password
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError);
        return { error: signInError };
      }

      // Session will be updated via onAuthStateChange
      return { error: null };
    } catch (err) {
      const authError = err as AuthError;
      setError(authError);
      return { error: authError };
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Sign up with email and password
  const signUp = useCallback(async (email: string, password: string, metadata?: Record<string, any>) => {
    try {
      setLoading(true);
      setError(null);

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata || {},
        },
      });

      if (signUpError) {
        setError(signUpError);
        return { error: signUpError };
      }

      // User will receive confirmation email
      return { error: null };
    } catch (err) {
      const authError = err as AuthError;
      setError(authError);
      return { error: authError };
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Sign out from Supabase - this clears the session and cookies
      // Using 'local' scope to only sign out this session (not all devices)
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });

      if (signOutError) {
        setError(signOutError);
        return { error: signOutError };
      }

      // Clear local state immediately
      setUser(null);
      setSession(null);

      // Clear any OAuth-related sessionStorage items
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('oauth_original_hostname');
        sessionStorage.removeItem('oauth_original_origin');
      }

      // Session cookies will be cleared by Supabase automatically
      // onAuthStateChange will also fire with SIGNED_OUT event
      return { error: null };
    } catch (err) {
      const authError = err as AuthError;
      setError(authError);
      return { error: authError };
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Sign in with OAuth provider
  const signInWithOAuth = useCallback(async (provider: 'google' | 'facebook' | 'apple') => {
    try {
      setLoading(true);
      setError(null);

      // Get the redirect URL - use client-side page route for OAuth callbacks
      // Client-side routes are more reliable for OAuth redirects in Next.js
      // Use the same protocol (HTTP or HTTPS) as the current page
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const port = window.location.port || '3000';
      let redirectUrl = `${protocol}//${hostname}:${port}/auth/callback`;
      
      // For localhost, ensure we use the correct protocol
      // If running in HTTPS mode, use HTTPS; otherwise use HTTP
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        // Use the same protocol as the current page
        redirectUrl = `${protocol}//${hostname}:${port}/auth/callback`;
      }

      // Log the redirect URL for debugging (remove in production)
      console.log('OAuth redirect URL:', redirectUrl);
      console.log('Current origin:', window.location.origin);
      console.log('Current hostname:', window.location.hostname);
      console.log('Current port:', window.location.port);

      // Store the original hostname in sessionStorage so we can use it in the callback
      // This is needed because Supabase might redirect to site_url (127.0.0.1) instead of redirectTo
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('oauth_original_hostname', window.location.hostname);
        sessionStorage.setItem('oauth_original_origin', window.location.origin);
      }

      const { error: oauthError, data } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          // Explicitly set query params to ensure redirectTo is used
          queryParams: {
            redirect_to: redirectUrl,
            // Force Google to show account selection screen
            // This allows users to choose a different account even if they've signed in before
            prompt: 'select_account',
          },
        },
      });

      if (oauthError) {
        console.error('OAuth error:', oauthError);
        console.error('OAuth error details:', JSON.stringify(oauthError, null, 2));
        setError(oauthError);
        return { error: oauthError };
      }

      // Log OAuth data for debugging
      if (data) {
        console.log('OAuth data:', data);
        console.log('OAuth URL:', data.url);
        // If we have a URL, the redirect should happen automatically
        // If we don't have a URL, there might be an issue
        if (!data.url) {
          console.error('OAuth data missing URL - this might indicate a configuration issue');
          console.error('Check if Google OAuth credentials are configured in Supabase');
        }
      } else {
        console.error('OAuth data is null - this might indicate a configuration issue');
        console.error('Check if Google OAuth credentials are configured in Supabase');
      }

      // User will be redirected to OAuth provider, then back to callback
      return { error: null };
    } catch (err) {
      console.error('OAuth exception:', err);
      const authError = err as AuthError;
      setError(authError);
      return { error: authError };
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Reset password
  const resetPassword = useCallback(async (email: string) => {
    try {
      setLoading(true);
      setError(null);

      // Get the redirect URL - normalize to HTTP for localhost in development
      let redirectUrl = `${window.location.origin}/auth/reset-password`;
      
      // For localhost, always use HTTP (not HTTPS) to match Supabase configuration
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        redirectUrl = `http://${window.location.hostname}:${window.location.port || '3000'}/auth/reset-password`;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (resetError) {
        setError(resetError);
        return { error: resetError };
      }

      return { error: null };
    } catch (err) {
      const authError = err as AuthError;
      setError(authError);
      return { error: authError };
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Refresh session
  const refreshSession = useCallback(async () => {
    try {
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        console.error('Error refreshing session:', refreshError);
        setError(refreshError);
        return;
      }

      setSession(refreshedSession);
      setUser(refreshedSession?.user ?? null);
    } catch (err) {
      console.error('Unexpected error refreshing session:', err);
      setError(err as AuthError);
    }
  }, [supabase]);

  // Accept terms of service
  const acceptTerms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !currentUser) {
        setError({ message: 'User not authenticated' });
        setLoading(false);
        return { error: { message: 'User not authenticated' } };
      }

      // Update user metadata with terms acceptance
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          ...(currentUser.user_metadata || {}),
          accepted_terms: true,
          terms_accepted_at: new Date().toISOString(),
        },
      });

      if (updateError) {
        setError(updateError);
        setLoading(false);
        return { error: updateError };
      }

      // Refresh session to get updated user data
      await refreshSession();
      setLoading(false);
      return { error: null };
    } catch (err) {
      const authError = err as AuthError;
      setError(authError);
      setLoading(false);
      return { error: authError };
    }
  }, [supabase, refreshSession]);

  // Context value
  const value: AuthContextType = {
    user,
    session,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    signInWithOAuth,
    resetPassword,
    refreshSession,
    acceptTerms,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

