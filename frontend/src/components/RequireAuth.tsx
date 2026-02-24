'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface RequireAuthProps {
  children: ReactNode;
  redirectTo?: string;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({
  children,
  redirectTo,
}) => {
  const { user, loading, session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] RequireAuth: loading=`, loading, 'user=', user ? user.email : 'null', 'session=', session ? 'exists' : 'null', 'pathname=', pathname);
    
    // Don't redirect if already on sign-in page
    const isOnSignInPage = pathname === '/sign-in' || pathname?.startsWith('/sign-in');
    if (isOnSignInPage) {
      console.log(`[${timestamp}] RequireAuth: Already on sign-in page, skipping redirect`);
      return; // Already on sign-in, don't redirect
    }
    
    // Wait for loading to complete before checking auth
    if (loading) {
      console.log(`[${timestamp}] RequireAuth: Still loading, waiting...`);
      return;
    }
    
    // Check if we have a session even if user is null (might be loading)
    // Only redirect if we're sure there's no session
    if (!user && !session) {
      console.log(`[${timestamp}] RequireAuth: No user and no session, redirecting to sign-in`);
      const target = redirectTo ?? pathname ?? '/';
      const params = new URLSearchParams();
      if (target && target !== '/') {
        params.set('redirect', target);
      }
      // Use replace to prevent back button from accessing protected page
      router.replace(`/sign-in${params.toString() ? `?${params}` : ''}`);
    } else if (!user && session) {
      console.log(`[${timestamp}] RequireAuth: No user but session exists, waiting for user to load...`);
      // Session exists but user not loaded yet - wait a bit
    } else if (user) {
      console.log(`[${timestamp}] RequireAuth: User authenticated:`, user.email);
    }
  }, [loading, redirectTo, user, session, router, pathname]);

  // Show loading state while checking authentication
  // IMPORTANT: Never render children until user is confirmed authenticated
  if (loading) {
    return (
      <main className="min-h-screen bg-cozy-background flex items-center justify-center">
        <div className="text-sm text-cozy-textSecondary" role="status" aria-live="polite">Checking your session…</div>
      </main>
    );
  }

  // If not loading and no user AND no session, show nothing (redirect is happening)
  // If we have a session but no user yet, wait a bit more (might be loading)
  if (!user && !session) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-cozy-background">
        <div className="text-sm text-cozy-textSecondary" role="status" aria-live="polite">Redirecting to sign in…</div>
      </main>
    );
  }

  // If we have a session but user is not loaded yet, show loading
  // This handles the case where session exists but user object is still loading
  if (session && !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-cozy-background">
        <div className="text-sm text-cozy-textSecondary" role="status" aria-live="polite">Loading user information…</div>
      </main>
    );
  }

  // User is authenticated, render children
  return <>{children}</>;
};

export default RequireAuth;

