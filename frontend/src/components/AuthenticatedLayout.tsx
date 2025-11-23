'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation } from '@/components/Navigation';
import { GlobalCreditBalanceBar } from '@/components/GlobalCreditBalanceBar';

/**
 * AuthenticatedLayout Component
 * 
 * SECURITY: This component ensures that Navigation and GlobalCreditBalanceBar
 * are ONLY rendered after authentication state has been confirmed.
 * 
 * This prevents the menu from flashing or appearing for unauthenticated users,
 * which is a critical security issue.
 * 
 * The component waits for:
 * 1. Auth loading to complete (loading === false)
 * 2. User to be authenticated (user !== null)
 * 
 * Only when BOTH conditions are met will the navigation components render.
 */
export const AuthenticatedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  // CRITICAL SECURITY CHECK:
  // Never render navigation components until authentication is fully confirmed.
  // This prevents any UI flash or exposure of protected UI elements.
  const isAuthenticated = !loading && user !== null;

  return (
    <>
      {/* Only render navigation components when authentication is confirmed */}
      {isAuthenticated && (
        <>
          <Navigation />
          <GlobalCreditBalanceBar />
        </>
      )}
      {children}
    </>
  );
};

