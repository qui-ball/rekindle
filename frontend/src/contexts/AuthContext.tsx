/**
 * Supabase Authentication Context
 * 
 * Provides authentication state and methods throughout the application.
 * Uses Supabase for authentication with automatic session management.
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
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

// AuthProvider component
interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<AuthError | null>(null);
  const [supabase, setSupabase] = useState<ReturnType<typeof getSupabaseClient> | null>(null);

  // Initialize Supabase client only in browser environment
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Clear any stale state when initializing
      setUser(null);
      setSession(null);
      setSupabase(getSupabaseClient());
    } else {
      // In SSR, ensure we're not showing stale data
      setUser(null);
      setSession(null);
      setLoading(false);
    }
  }, []);

  // Get current session and user
  const getSession = useCallback(async () => {
    if (!supabase) return;
    
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

  // Initialize auth state on mount (only when supabase client is available)
  useEffect(() => {
    if (!supabase) {
      // Keep loading true until client is ready, but clear stale state
      if (typeof window !== 'undefined') {
        // Client is still initializing, keep loading
        setLoading(true);
      }
      return;
    }

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
    if (!supabase) {
      return { error: { message: 'Authentication not available' } };
    }

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
    if (!supabase) {
      return { error: { message: 'Authentication not available' } };
    }

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
    if (!supabase) {
      return { error: { message: 'Authentication not available' } };
    }

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
    if (!supabase || typeof window === 'undefined') {
      return { error: { message: 'Authentication not available' } };
    }

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
    if (!supabase || typeof window === 'undefined') {
      return { error: { message: 'Authentication not available' } };
    }

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
    if (!supabase) {
      return;
    }

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
    if (!supabase) {
      return { error: { message: 'Authentication not available' } };
    }

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

