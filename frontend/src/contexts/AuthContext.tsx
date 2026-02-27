/**
 * Supabase Authentication Context
 * 
 * Provides authentication state and methods throughout the application.
 * Uses Supabase for authentication with automatic session management.
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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
  signUp: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<{ error: AuthError | null }>;
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
  
  // Load lastActivityTime from localStorage, or use current time if not set
  const getStoredLastActivityTime = (): number => {
    if (typeof window === 'undefined') {
      return Date.now();
    }
    const stored = localStorage.getItem('lastActivityTime');
    if (stored) {
      const parsed = parseInt(stored, 10);
      // Validate stored time is reasonable (not in the future, not too old)
      const now = Date.now();
      if (!isNaN(parsed) && parsed <= now && parsed > now - 365 * 24 * 60 * 60 * 1000) {
        return parsed;
      }
    }
    return Date.now();
  };
  
  const [lastActivityTime, setLastActivityTime] = useState<number>(getStoredLastActivityTime());
  const lastActivityTimeRef = useRef(lastActivityTime);

  // Keep ref in sync so subscription callback can read latest without being in effect deps (avoids infinite loop)
  useEffect(() => {
    lastActivityTimeRef.current = lastActivityTime;
  }, [lastActivityTime]);

  // Update both state and localStorage when activity time changes
  const updateLastActivityTime = useCallback((time: number) => {
    setLastActivityTime(time);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastActivityTime', time.toString());
    }
  }, []);

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
    if (!supabase) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] getSession: No supabase client yet`);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);

      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] getSession: Fetching session...`);
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error(`[${timestamp}] getSession: Error getting session:`, sessionError);
        setError(sessionError);
        setSession(null);
        setUser(null);
        setLoading(false);
        // Clear stored activity time on error
        if (typeof window !== 'undefined') {
          localStorage.removeItem('lastActivityTime');
        }
        return;
      }

      console.log(`[${timestamp}] getSession: Session result:`, currentSession ? `has session, user: ${currentSession.user?.email}` : 'no session');
      
      // CRITICAL SECURITY CHECK: Verify idle timeout BEFORE setting user/session
      // This prevents the menu from showing for users who haven't been active
      if (currentSession) {
        const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
        const storedLastActivity = getStoredLastActivityTime();
        const timeSinceLastActivity = Date.now() - storedLastActivity;
        
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] getSession: Checking idle timeout - last activity: ${new Date(storedLastActivity).toISOString()}, time since: ${Math.round(timeSinceLastActivity / 1000 / 60)} minutes`);
        
        if (timeSinceLastActivity >= IDLE_TIMEOUT_MS) {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] getSession: Idle timeout exceeded, signing out immediately`);
          // Sign out immediately - don't set session/user
          await supabase.auth.signOut({ scope: 'local' });
          setSession(null);
          setUser(null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('lastActivityTime');
          }
          setLoading(false);
          return;
        }
        
        // Session is valid and not idle - set session and user
        setSession(currentSession);
        setUser(currentSession.user ?? null);
        
        if (currentSession.user) {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] getSession: User set successfully:`, currentSession.user.email);
          // Update activity time to now since we're loading an active session
          // This ensures the timer starts fresh when the page loads
          updateLastActivityTime(Date.now());
        } else {
          const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] getSession: No user in session`);
        }
      } else {
        // No session - clear everything
        setSession(null);
        setUser(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('lastActivityTime');
        }
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] getSession: No session found`);
      }
    } catch (err) {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] getSession: Unexpected error:`, err);
      setError(err as AuthError);
      setSession(null);
      setUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('lastActivityTime');
      }
    } finally {
      setLoading(false);
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] getSession: Loading set to false`);
    }
  }, [supabase, updateLastActivityTime]);

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
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] Auth state change:`, event, session ? 'has session' : 'no session');
      
      // Handle explicit sign-out events
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setLoading(false);
        setError(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('lastActivityTime');
        }
        // Redirect to sign-in if we're on a protected route (but not if already on sign-in)
        if (typeof window !== 'undefined') {
          const pathname = window.location.pathname;
          const isOnSignInPage = pathname === '/sign-in' || pathname.startsWith('/sign-in');
          const protectedRoutes = ['/upload', '/gallery', '/dashboard', '/photos', '/settings'];
          const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
          // Only redirect if on protected route AND not already on sign-in page
          if (isProtectedRoute && !isOnSignInPage) {
            window.location.href = `/sign-in?error=Session expired. Please sign in again.&next=${encodeURIComponent(pathname)}`;
          }
        }
        return;
      }

      // Handle INITIAL_SESSION with no session - this means there's genuinely no session
      // (user signed out, session expired, etc.) - we should clear state
      if (event === 'INITIAL_SESSION' && !session) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] INITIAL_SESSION with no session - clearing auth state`);
        setSession(null);
        setUser(null);
        setLoading(false);
        setError(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('lastActivityTime');
        }
        return;
      }

      // Handle null session for other events (might be temporary during refresh)
      // Only skip clearing state for TOKEN_REFRESHED events which might temporarily have null session
      if (!session && event !== 'TOKEN_REFRESHED') {
        // For other events with null session, clear state to be safe
        console.log('Session is null for event:', event, '- clearing auth state');
        setSession(null);
        setUser(null);
        setLoading(false);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('lastActivityTime');
        }
        return;
      }

      // Reset activity timer ONLY on sign in (not on automatic token refresh)
      // Token refresh happens automatically and should NOT reset idle timeout
      // Only actual user activity should reset the idle timer
      if (event === 'SIGNED_IN') {
        updateLastActivityTime(Date.now());
      }
      // NOTE: We intentionally do NOT reset activity time on TOKEN_REFRESHED
      // because automatic token refreshes should not extend the idle timeout

      // CRITICAL SECURITY: Check idle timeout when TOKEN_REFRESHED event fires
      // If user is idle, we should NOT accept the refreshed token (use ref to avoid effect deps → infinite loop)
      if (event === 'TOKEN_REFRESHED' && session) {
        const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
        const now = Date.now();
        const timeSinceLastActivity = now - lastActivityTimeRef.current;
        
        if (timeSinceLastActivity >= IDLE_TIMEOUT_MS) {
          // User is idle but Supabase auto-refreshed the token
          // Reject this refresh and sign out immediately
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] SECURITY: TOKEN_REFRESHED event but user is idle (${Math.round(timeSinceLastActivity / 1000 / 60)} minutes), rejecting refresh and signing out`);
          await supabase.auth.signOut({ scope: 'local' });
          setSession(null);
          setUser(null);
          setLoading(false);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('lastActivityTime');
            const pathname = window.location.pathname;
            const isOnSignInPage = pathname === '/sign-in' || pathname.startsWith('/sign-in');
            const protectedRoutes = ['/upload', '/gallery', '/dashboard', '/photos', '/settings'];
            const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
            console.log(`[${timestamp}] Idle timeout: pathname=${pathname}, isProtectedRoute=${isProtectedRoute}, isOnSignInPage=${isOnSignInPage}`);
            if (isProtectedRoute && !isOnSignInPage) {
              console.log(`[${timestamp}] Redirecting idle user to sign-in from ${pathname}`);
              // Use window.location.replace to ensure navigation happens
              window.location.replace(`/sign-in?error=${encodeURIComponent('Session expired due to inactivity. Please sign in again.')}`);
              return; // Ensure we return early
            }
          }
          return;
        }
      }

      // Update session and user
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      setError(null);
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lastActivityTime/updateLastActivityTime omitted: callback uses lastActivityTimeRef; including them would re-run effect when getSession() calls updateLastActivityTime → infinite loop
  }, [supabase, getSession]);


  // Update last activity time on user interaction
  useEffect(() => {
    if (typeof window === 'undefined' || !user) {
      return;
    }

    const updateActivity = () => {
      updateLastActivityTime(Date.now());
    };

    // Track various user activities
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [user, updateLastActivityTime]);

  // Check session expiration periodically and handle automatic logout
  useEffect(() => {
    if (!supabase || typeof window === 'undefined') {
      return;
    }

    const checkSessionExpiration = async () => {
      const timestamp = new Date().toISOString();
      try {
        // CRITICAL: Check idle timeout FIRST before doing anything else
        // This prevents session refresh when user is idle
        const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
        const now = Date.now();
        const timeSinceLastActivity = now - lastActivityTime;
        
        if (timeSinceLastActivity >= IDLE_TIMEOUT_MS) {
          // User has been idle for too long - sign out immediately
          // DO NOT refresh session - this is a security requirement
          console.log(`[${timestamp}] SECURITY: Idle timeout exceeded (${Math.round(timeSinceLastActivity / 1000 / 60)} minutes idle), signing out immediately`);
          await supabase.auth.signOut({ scope: 'local' });
          if (typeof window !== 'undefined') {
            localStorage.removeItem('lastActivityTime');
          }
          // Clear state immediately to prevent UI from showing
          setSession(null);
          setUser(null);
          setLoading(false);
          // Redirect to sign-in if on protected route
          if (typeof window !== 'undefined') {
            const pathname = window.location.pathname;
            const isOnSignInPage = pathname === '/sign-in' || pathname.startsWith('/sign-in');
            const protectedRoutes = ['/upload', '/gallery', '/dashboard', '/photos', '/settings'];
            const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
            if (isProtectedRoute && !isOnSignInPage) {
              window.location.href = `/sign-in?error=Session expired due to inactivity. Please sign in again.`;
            }
          }
          return;
        }

        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        
        // If there's an error getting session, don't clear state - might be temporary
        if (sessionError) {
          console.warn(`[${timestamp}] Error checking session expiration:`, sessionError);
          return;
        }
        
        if (!currentSession) {
          // No session - clear state
          console.log(`[${timestamp}] No session found, clearing state`);
          setSession(null);
          setUser(null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('lastActivityTime');
          }
          return;
        }

        // Check if access token is expired (expires_at is in seconds)
        const expiresAt = currentSession.expires_at;
        if (expiresAt) {
          const expirationTime = expiresAt * 1000; // Convert to milliseconds
          const timeUntilExpiration = expirationTime - now;

          // CRITICAL: Only refresh if:
          // 1. Token is expiring soon (< 5 minutes)
          // 2. User is NOT idle (activity within last hour)
          // This prevents automatic token refresh from extending idle sessions
          if (timeUntilExpiration < 5 * 60 * 1000 && timeSinceLastActivity < IDLE_TIMEOUT_MS) {
            console.log(`[${timestamp}] Session expiring soon (${Math.round(timeUntilExpiration / 1000 / 60)} minutes), user is active (${Math.round(timeSinceLastActivity / 1000 / 60)} minutes since activity), attempting refresh...`);
            const { data: { session: refreshedSession }, error: refreshError } = 
              await supabase.auth.refreshSession();

            if (refreshError || !refreshedSession) {
              // Refresh failed - session is truly expired, sign out
              console.warn(`[${timestamp}] Session refresh failed, signing out:`, refreshError);
              await supabase.auth.signOut({ scope: 'local' });
              setSession(null);
              setUser(null);
              if (typeof window !== 'undefined') {
                localStorage.removeItem('lastActivityTime');
              }
              return;
            }

            // Session refreshed successfully
            // NOTE: We do NOT reset lastActivityTime here - only user activity should reset it
            console.log(`[${timestamp}] Session refreshed successfully (user still active)`);
            setSession(refreshedSession);
            setUser(refreshedSession.user);
          } else if (timeUntilExpiration < 0) {
            // Token is already expired
            console.log(`[${timestamp}] Session token expired, signing out`);
            await supabase.auth.signOut({ scope: 'local' });
            setSession(null);
            setUser(null);
            if (typeof window !== 'undefined') {
              localStorage.removeItem('lastActivityTime');
            }
          } else if (timeUntilExpiration < 5 * 60 * 1000 && timeSinceLastActivity >= IDLE_TIMEOUT_MS) {
            // Token is expiring but user is idle - DO NOT refresh, sign out instead
            console.log(`[${timestamp}] SECURITY: Token expiring but user is idle (${Math.round(timeSinceLastActivity / 1000 / 60)} minutes), signing out instead of refreshing`);
            await supabase.auth.signOut({ scope: 'local' });
            setSession(null);
            setUser(null);
            if (typeof window !== 'undefined') {
              localStorage.removeItem('lastActivityTime');
            }
            // Redirect to sign-in
            if (typeof window !== 'undefined') {
              const pathname = window.location.pathname;
              const isOnSignInPage = pathname === '/sign-in' || pathname.startsWith('/sign-in');
              const protectedRoutes = ['/upload', '/gallery', '/dashboard', '/photos', '/settings'];
              const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
              if (isProtectedRoute && !isOnSignInPage) {
                window.location.href = `/sign-in?error=Session expired due to inactivity. Please sign in again.`;
              }
            }
          }
        }
      } catch (error) {
        console.error(`[${timestamp}] Error checking session expiration:`, error);
        // On error, try to get current session to verify it still exists
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) {
          // Session is gone, sign out
          console.log(`[${timestamp}] Session not found after error, signing out`);
          await supabase.auth.signOut({ scope: 'local' });
          setSession(null);
          setUser(null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('lastActivityTime');
          }
        }
      }
    };

    // Check immediately
    checkSessionExpiration();

    // Check every minute (60000ms) for session expiration and idle timeout
    const intervalId = setInterval(checkSessionExpiration, 60000);

    return () => {
      clearInterval(intervalId);
    };
  }, [supabase, lastActivityTime, updateLastActivityTime]);

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
  const signUp = useCallback(async (email: string, password: string, metadata?: Record<string, unknown>) => {
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

