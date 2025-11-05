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
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  signInWithOAuth: (provider: 'google' | 'facebook' | 'apple') => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  refreshSession: () => Promise<void>;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Supabase client instance
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null;

const getSupabaseClient = () => {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Missing Supabase environment variables. Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
      );
    }

    supabaseClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
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
  const signUp = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
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

      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        setError(signOutError);
        return { error: signOutError };
      }

      // Session will be cleared via onAuthStateChange
      setUser(null);
      setSession(null);
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

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (oauthError) {
        setError(oauthError);
        return { error: oauthError };
      }

      // User will be redirected to OAuth provider, then back to callback
      return { error: null };
    } catch (err) {
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

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
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

