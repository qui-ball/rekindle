'use client';

import React from 'react';
import { CreditBalance } from '../../types/photo-management';
import { Container } from '../ui/Container';
import { Button } from '../ui/Button';

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
    <svg className="h-4 w-4 text-cozy-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  );

  const PlusIcon = () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );

  return (
    <div className="bg-cozy-mount border-b border-cozy-borderCard px-4 py-2">
      <Container>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <CreditCardIcon />
              <span className="text-sm font-medium text-cozy-heading font-serif">
                Total: {balance.totalCredits}
              </span>
            </div>
          </div>
          <Button
            onClick={onPurchaseCredits}
            variant="primary"
            size="default"
            className="flex items-center gap-1 text-cozy-button"
            aria-label="Purchase additional credits"
          >
            <PlusIcon />
            <span>Add Credits</span>
          </Button>
        </div>
      </Container>
    </div>
  );
};

export default CreditBalanceBar;
