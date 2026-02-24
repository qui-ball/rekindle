'use client';

import React, { useState, useEffect } from 'react';
import { CreditBalance } from '@/types/photo-management';
import { CreditBalanceDisplay } from '@/components/PhotoManagement/CreditBalanceDisplay';
import { ErrorBoundary } from '@/components/PhotoManagement/ErrorBoundary';
import { RequireAuth } from '@/components/RequireAuth';
import { Container, Card, Headline, Body, Button } from '@/components/ui';

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
      <main className="min-h-screen bg-cozy-background">
        <Container verticalPadding>
          <div className="max-w-4xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-cozy-mount rounded w-1/4 mb-6"></div>
              <div className="h-32 bg-cozy-surface rounded-cozy-lg border border-cozy-borderCard"></div>
            </div>
          </div>
        </Container>
      </main>
    );
  } else if (error) {
    content = (
      <main className="min-h-screen bg-cozy-background">
        <Container verticalPadding>
          <div className="max-w-4xl mx-auto">
            <div className="bg-cozy-mount border border-cozySemantic-error rounded-cozy-md p-4" role="alert">
              <Headline level={2} as="h2" className="text-cozy-heading mb-2">
                Error
              </Headline>
              <Body className="text-cozy-text mb-4">{error}</Body>
              <Button variant="primary" onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </div>
        </Container>
      </main>
    );
  } else {
    content = (
      <main className="min-h-screen bg-cozy-background">
        <Container verticalPadding>
          <div className="max-w-4xl mx-auto">
            {/* Page Header */}
            <div className="mb-8">
              <Headline level={1} className="text-cozy-heading mb-2">
                Subscription & Credits
              </Headline>
              <Body className="text-cozy-text">
                Manage your subscription and credit balance
              </Body>
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
              <Card className="p-6">
                <Headline level={2} as="h2" className="text-cozy-heading mb-4">
                  Subscription Plans
                </Headline>
                <div className="space-y-4">
                  <div className="border border-cozy-borderCard rounded-cozy-md p-4">
                    <Headline level={3} as="h3" className="text-cozy-heading font-medium">
                      Remember
                    </Headline>
                    <Body className="text-cozy-text text-sm">$9.99/month</Body>
                    <Body className="text-cozy-text text-sm">25 credits monthly</Body>
                  </div>
                  <div className="border border-cozy-borderCard rounded-cozy-md p-4">
                    <Headline level={3} as="h3" className="text-cozy-heading font-medium">
                      Cherish
                    </Headline>
                    <Body className="text-cozy-text text-sm">$19.99/month</Body>
                    <Body className="text-cozy-text text-sm">60 credits monthly</Body>
                  </div>
                  <div className="border border-cozy-borderCard rounded-cozy-md p-4">
                    <Headline level={3} as="h3" className="text-cozy-heading font-medium">
                      Forever
                    </Headline>
                    <Body className="text-cozy-text text-sm">$39.99/month</Body>
                    <Body className="text-cozy-text text-sm">150 credits monthly</Body>
                  </div>
                </div>
              </Card>

              {/* Credit Packages */}
              <Card className="p-6">
                <Headline level={2} as="h2" className="text-cozy-heading mb-4">
                  Credit Packages
                </Headline>
                <div className="space-y-4">
                  <div className="border border-cozy-borderCard rounded-cozy-md p-4">
                    <Headline level={3} as="h3" className="text-cozy-heading font-medium">
                      Starter Pack
                    </Headline>
                    <Body className="text-cozy-text text-sm">$4.99</Body>
                    <Body className="text-cozy-text text-sm">10 credits</Body>
                  </div>
                  <div className="border border-cozy-borderCard rounded-cozy-md p-4">
                    <Headline level={3} as="h3" className="text-cozy-heading font-medium">
                      Family Pack
                    </Headline>
                    <Body className="text-cozy-text text-sm">$12.99</Body>
                    <Body className="text-cozy-text text-sm">30 credits</Body>
                  </div>
                  <div className="border border-cozy-borderCard rounded-cozy-md p-4">
                    <Headline level={3} as="h3" className="text-cozy-heading font-medium">
                      Heritage Pack
                    </Headline>
                    <Body className="text-cozy-text text-sm">$39.99</Body>
                    <Body className="text-cozy-text text-sm">100 credits</Body>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </Container>
      </main>
    );
  }

  return <RequireAuth>{content}</RequireAuth>;
}
