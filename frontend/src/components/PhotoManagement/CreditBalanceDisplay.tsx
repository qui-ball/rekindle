'use client';

import React from 'react';
import { CreditBalanceDisplayProps } from '../../types/photo-management';

/**
 * CreditBalanceDisplay Component
 * 
 * Prominent credit balance display with separate subscription and top-up credit tracking.
 * Features:
 * - Separate display for subscription credits (used first, monthly reset)
 * - Separate display for top-up credits (used second, carry over)
 * - Visual indicators showing which credits will be used for current processing
 * - Low credit warning with purchase prompts
 * - Quick access to subscription and top-up pages
 * - Real-time balance updates with usage breakdown
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

  // Format date for monthly reset
  const formatResetDate = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
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

      {/* Credit Balances */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
        {/* Subscription Credits */}
        <div className="bg-blue-50 rounded-lg p-3" role="group" aria-label="Subscription credits">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">Subscription Credits</span>
            <span className="text-lg font-bold text-blue-900" aria-live="polite">
              {formatCredits(balance.subscriptionCredits)}
            </span>
          </div>
          <div className="text-xs text-blue-700">
            {balance.monthlyResetDate ? (
              <>Resets {formatResetDate(balance.monthlyResetDate)}</>
            ) : (
              <>Used first, monthly reset</>
            )}
          </div>
        </div>

        {/* Top-up Credits */}
        <div className="bg-green-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-900">Top-up Credits</span>
            <span className="text-lg font-bold text-green-900">
              {formatCredits(balance.topupCredits)}
            </span>
          </div>
          <div className="text-xs text-green-700">
            Carries over month to month
          </div>
        </div>
      </div>

      {/* Total Credits */}
      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900">Total Available</span>
          <span className="text-xl font-bold text-gray-900">
            {formatCredits(balance.totalCredits)}
          </span>
        </div>
      </div>

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
