'use client';

import React, { useState, useEffect } from 'react';
import { CreditBalance } from '../types/photo-management';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * GlobalCreditBalanceBar Component
 * 
 * A thin, horizontal bar that displays credit balance with icons.
 * Appears on all pages between navigation and page content.
 * Features:
 * - Compact display of unified credit balance
 * - Plus icon for purchasing additional credits
 * - Clean, minimal design that doesn't distract from content
 * - Only visible when user is signed in
 */
export const GlobalCreditBalanceBar: React.FC = () => {
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();

  // Mock user ID - in real app, get from auth context
  const userId = user?.id || 'user-123';

  useEffect(() => {
    // Only load credit balance if user is authenticated
    if (!user) {
      return;
    }

    const loadCreditBalance = async () => {
      try {
        setIsLoading(true);
        // Use mock data directly instead of API call
        const mockBalance: CreditBalance = {
          totalCredits: 120,
          subscriptionTier: 'remember',
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          lowCreditWarning: false,
          creditHistory: [],
          usageRules: {
            creditsCarryOver: true,
            lostOnCancellation: true
          }
        };
        setCreditBalance(mockBalance);
      } catch (err) {
        console.error('Failed to load credit balance:', err);
        // Don't show error state for global bar, just hide it
        setCreditBalance(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadCreditBalance();
  }, [userId, user]);

  // SECURITY: Never show credit bar if user is not authenticated
  // This prevents credit information from being visible to unauthenticated users
  // NOTE: All hooks must be called before any conditional returns
  if (!user) {
    return null;
  }
  
  // During auth loading, don't show credit bar to prevent flash
  if (authLoading) {
    return null;
  }

  const handlePurchaseCredits = () => {
    // Navigate to subscription page
    router.push('/subscription');
  };

  // Don't render if still loading credit balance or no balance available
  // User check is already done above
  if (isLoading || !creditBalance) {
    return null;
  }

  // Simple SVG icons
  const CreditCardIcon = () => (
    <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  );

  const PlusIcon = () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );

  return (
    <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
      <div className="container mx-auto">
        <div className="flex items-center justify-end space-x-4">
          {/* Unified Credit Balance */}
          <div className="flex items-center space-x-2">
            <CreditCardIcon />
            <span className="text-sm font-medium text-gray-700">
              Credits: {creditBalance.totalCredits}
            </span>
          </div>

          {/* Purchase Credits Button */}
          <button
            onClick={handlePurchaseCredits}
            className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            aria-label="Purchase additional credits"
          >
            <PlusIcon />
            <span>Add Credits</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalCreditBalanceBar;
