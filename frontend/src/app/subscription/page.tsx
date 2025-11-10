'use client';

import React, { useState, useEffect } from 'react';
import { CreditBalance } from '@/types/photo-management';
import { CreditBalanceDisplay } from '@/components/PhotoManagement/CreditBalanceDisplay';
import { ErrorBoundary } from '@/components/PhotoManagement/ErrorBoundary';
import { RequireAuth } from '@/components/RequireAuth';

export default function SubscriptionPage() {
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock user ID - in real app, get from auth context
  const userId = 'user-123';

  useEffect(() => {
  const loadCreditBalance = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Use mock data directly instead of API call
      const mockBalance: CreditBalance = {
        totalCredits: 120,
        subscriptionTier: 'remember',
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        lowCreditWarning: false,
        creditHistory: [
          {
            id: '1',
            type: 'earned',
            amount: 25,
            description: 'Monthly subscription credits',
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
          },
          {
            id: '2',
            type: 'purchased',
            amount: 100,
            description: 'Top-up credit purchase',
            createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
          },
          {
            id: '3',
            type: 'spent',
            amount: -5,
            description: 'Photo restoration',
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          }
        ],
        usageRules: {
          creditsCarryOver: true,
          lostOnCancellation: true
        }
      };
      setCreditBalance(mockBalance);
    } catch (err) {
      console.error('Failed to load credit balance:', err);
      setError('Failed to load credit information. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

    loadCreditBalance();
  }, [userId]);

  const handlePurchaseCredits = () => {
    // Navigate to credit purchase page or open modal
    console.log('Navigate to credit purchase');
    // TODO: Implement credit purchase flow
  };

  const handleViewSubscription = () => {
    // Navigate to subscription management page
    console.log('Navigate to subscription management');
    // TODO: Implement subscription management flow
  };

  let content: React.ReactNode;

  if (isLoading) {
    content = (
      <main className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="h-32 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        </div>
      </main>
    );
  } else if (error) {
    content = (
      <main className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
              <p className="text-red-700">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  } else {
    content = (
      <main className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Page Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Subscription & Credits
              </h1>
              <p className="text-gray-600">
                Manage your subscription and credit balance
              </p>
            </div>

            {/* Credit Balance Display */}
            {creditBalance && (
              <ErrorBoundary>
                <CreditBalanceDisplay
                  balance={creditBalance}
                  onPurchaseCredits={handlePurchaseCredits}
                  onViewSubscription={handleViewSubscription}
                  showWarning={creditBalance.lowCreditWarning}
                />
              </ErrorBoundary>
            )}

            {/* Additional Subscription Content */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Subscription Plans */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Subscription Plans
                </h2>
                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900">Remember</h3>
                    <p className="text-sm text-gray-600">$9.99/month</p>
                    <p className="text-sm text-gray-600">25 credits monthly</p>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900">Cherish</h3>
                    <p className="text-sm text-gray-600">$19.99/month</p>
                    <p className="text-sm text-gray-600">60 credits monthly</p>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900">Forever</h3>
                    <p className="text-sm text-gray-600">$39.99/month</p>
                    <p className="text-sm text-gray-600">150 credits monthly</p>
                  </div>
                </div>
              </div>

              {/* Credit Packages */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Credit Packages
                </h2>
                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900">Starter Pack</h3>
                    <p className="text-sm text-gray-600">$4.99</p>
                    <p className="text-sm text-gray-600">10 credits</p>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900">Family Pack</h3>
                    <p className="text-sm text-gray-600">$12.99</p>
                    <p className="text-sm text-gray-600">30 credits</p>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900">Heritage Pack</h3>
                    <p className="text-sm text-gray-600">$39.99</p>
                    <p className="text-sm text-gray-600">100 credits</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return <RequireAuth>{content}</RequireAuth>;
}
