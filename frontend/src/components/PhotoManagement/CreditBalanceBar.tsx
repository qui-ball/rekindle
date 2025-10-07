'use client';

import React from 'react';
import { CreditBalance } from '../../types/photo-management';

interface CreditBalanceBarProps {
  balance: CreditBalance;
  onPurchaseCredits: () => void;
  onViewSubscription?: () => void;
}

/**
 * CreditBalanceBar Component
 * 
 * A thin, horizontal bar that displays credit balances with icons.
 * Features:
 * - Compact display of subscription and top-up credits
 * - Plus icon for purchasing additional credits
 * - Clean, minimal design that doesn't distract from gallery
 */
export const CreditBalanceBar: React.FC<CreditBalanceBarProps> = ({
  balance,
  onPurchaseCredits,
  onViewSubscription: _onViewSubscription
}) => {
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
        <div className="flex items-center justify-between">
          {/* Credit Balances */}
          <div className="flex items-center space-x-6">
            {/* Subscription Credits */}
            <div className="flex items-center space-x-2">
              <CreditCardIcon />
              <span className="text-sm font-medium text-gray-700">
                Sub: {balance.subscriptionCredits}
              </span>
            </div>
            
            {/* Top-up Credits */}
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                <span className="text-xs text-white font-bold">T</span>
              </div>
              <span className="text-sm font-medium text-gray-700">
                Top-up: {balance.topupCredits}
              </span>
            </div>
          </div>

          {/* Purchase Credits Button */}
          <button
            onClick={onPurchaseCredits}
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

export default CreditBalanceBar;
