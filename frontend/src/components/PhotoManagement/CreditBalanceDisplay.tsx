'use client';

import React from 'react';
import { CreditBalanceDisplayProps } from '../../types/photo-management';
import { Card } from '../ui/Card';
import { Headline } from '../ui/Headline';
import { Body } from '../ui/Body';
import { Button } from '../ui/Button';

/**
 * CreditBalanceDisplay Component
 * 
 * Prominent credit balance display with unified credit tracking.
 * Features:
 * - Display total credits available (all credits carry over)
 * - Clear indication that credits accumulate month-to-month
 * - Warning that credits are lost if subscription is cancelled
 * - Low credit warning with purchase prompts
 * - Quick access to subscription and credit purchase pages
 * - Real-time balance updates
 */
export const CreditBalanceDisplay: React.FC<CreditBalanceDisplayProps> = ({
  balance,
  onPurchaseCredits,
  onViewSubscription,
  showWarning
}) => {
  // Format credit count with proper pluralization
  const formatCredits = (count: number) => {
    return `${count} credit${count !== 1 ? 's' : ''}`;
  };

  // Format date for next billing
  const formatBillingDate = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get tier display name
  const getTierDisplayName = (tier: string) => {
    const tierNames = {
      free: 'Free',
      remember: 'Remember',
      cherish: 'Cherish',
      forever: 'Forever'
    };
    return tierNames[tier as keyof typeof tierNames] || tier;
  };

  return (
    <Card className="p-4 mb-6" role="region" aria-label="Credit balance">
      <div className="flex items-center justify-between mb-4">
        <Headline level={3} className="text-lg font-semibold">Credit Balance</Headline>
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 text-xs font-medium rounded-full font-serif ${
            balance.subscriptionTier === 'free'
              ? 'bg-cozy-mount text-cozy-textSecondary'
              : 'bg-cozy-borderCard text-cozy-accentDark'
          }`}>
            {getTierDisplayName(balance.subscriptionTier)}
          </span>
        </div>
      </div>

      <div className="bg-cozy-mount border border-cozy-borderCard rounded-cozy-md p-6 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-cozy-heading font-serif">Total Credits</span>
          <span className="text-3xl font-bold text-cozy-heading font-serif" aria-live="polite">
            {formatCredits(balance.totalCredits)}
          </span>
        </div>
        <div className="flex items-center space-x-2 text-xs text-cozy-textSecondary font-serif">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>All credits carry over month-to-month</span>
        </div>
        {balance.nextBillingDate && balance.subscriptionTier !== 'free' && (
          <div className="mt-2 pt-2 border-t border-cozy-borderCard">
            <div className="text-xs text-cozy-textSecondary font-serif">
              Next billing: {formatBillingDate(balance.nextBillingDate)}
            </div>
          </div>
        )}
      </div>

      {balance.subscriptionTier !== 'free' && (
        <div className="rounded-cozy-md border border-cozySemantic-warning bg-cozy-mount p-3 mb-4">
          <div className="flex items-start space-x-2">
            <svg className="w-5 h-5 text-cozySemantic-warning mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-xs text-cozy-text font-serif">
              <strong>Note:</strong> Cancelling your subscription will result in the loss of all remaining credits.
            </span>
          </div>
        </div>
      )}

      {showWarning && (
        <div className="rounded-cozy-md border border-cozySemantic-warning bg-cozy-mount p-3 mb-4">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-cozySemantic-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <Body className="text-sm !mb-0">
              You&apos;re running low on credits. Consider purchasing more to continue processing.
            </Body>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          onClick={onPurchaseCredits}
          variant="primary"
          size="large"
          className="flex-1 touch-manipulation min-h-[44px]"
          aria-label="Purchase additional credits"
        >
          Purchase Credits
        </Button>
        <Button
          onClick={onViewSubscription}
          variant="secondary"
          size="large"
          className="flex-1 touch-manipulation min-h-[44px]"
          aria-label="View subscription details"
        >
          Manage Subscription
        </Button>
      </div>

      {balance.creditHistory.length > 0 && (
        <div className="mt-4 pt-4 border-t border-cozy-borderCard">
          <Headline level={3} className="text-sm font-medium mb-2">Recent Activity</Headline>
          <div className="space-y-1">
            {balance.creditHistory.slice(0, 3).map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between text-xs font-serif">
                <span className="text-cozy-textSecondary">{transaction.description}</span>
                <span className={`font-medium ${
                  transaction.type === 'earned' || transaction.type === 'purchased'
                    ? 'text-cozySemantic-success'
                    : 'text-cozySemantic-error'
                }`}>
                  {transaction.type === 'earned' || transaction.type === 'purchased' ? '+' : '-'}
                  {transaction.amount} credits
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

export default CreditBalanceDisplay;
