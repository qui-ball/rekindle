'use client';

import React from 'react';
import { CreditBalanceDisplayProps } from '../../types/photo-management';

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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6" role="region" aria-label="Credit balance">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Credit Balance</h2>
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
            balance.subscriptionTier === 'free' 
              ? 'bg-gray-100 text-gray-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {getTierDisplayName(balance.subscriptionTier)}
          </span>
        </div>
      </div>

      {/* Unified Credit Balance */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-blue-900">Total Credits</span>
          <span className="text-3xl font-bold text-blue-900" aria-live="polite">
            {formatCredits(balance.totalCredits)}
          </span>
        </div>
        <div className="flex items-center space-x-2 text-xs text-blue-700">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>All credits carry over month-to-month</span>
        </div>
        {balance.nextBillingDate && balance.subscriptionTier !== 'free' && (
          <div className="mt-2 pt-2 border-t border-blue-200">
            <div className="text-xs text-blue-700">
              Next billing: {formatBillingDate(balance.nextBillingDate)}
            </div>
          </div>
        )}
      </div>

      {/* Cancellation Warning for Subscribed Users */}
      {balance.subscriptionTier !== 'free' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <div className="flex items-start space-x-2">
            <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-xs text-amber-800">
              <strong>Note:</strong> Cancelling your subscription will result in the loss of all remaining credits.
            </span>
          </div>
        </div>
      )}

      {/* Low Credit Warning */}
      {showWarning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-sm text-yellow-800">
              You&apos;re running low on credits. Consider purchasing more to continue processing.
            </span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={onPurchaseCredits}
          className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-3 px-4 rounded-lg font-medium transition-colors touch-manipulation min-h-[44px]"
          aria-label="Purchase additional credits"
        >
          Purchase Credits
        </button>
        <button
          onClick={onViewSubscription}
          className="flex-1 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium transition-colors touch-manipulation min-h-[44px]"
          aria-label="View subscription details"
        >
          Manage Subscription
        </button>
      </div>

      {/* Recent Activity (if available) */}
      {balance.creditHistory.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Recent Activity</h3>
          <div className="space-y-1">
            {balance.creditHistory.slice(0, 3).map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-600">{transaction.description}</span>
                <span className={`font-medium ${
                  transaction.type === 'earned' || transaction.type === 'purchased'
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  {transaction.type === 'earned' || transaction.type === 'purchased' ? '+' : '-'}
                  {transaction.amount} credits
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditBalanceDisplay;
