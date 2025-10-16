'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { ProcessingOptionsPanelProps, ProcessingOptions, CostBreakdown } from '../../types/photo-management';

/**
 * ProcessingOptionsPanel Component
 * 
 * Interactive panel for selecting processing options with real-time credit calculation.
 * Features:
 * - Dynamic checkbox options based on available credits
 * - Real-time credit cost calculation with discount display
 * - Disabled state for unaffordable options
 * - Combined processing discount indicators
 * - Processing confirmation with cost breakdown
 */
export const ProcessingOptionsPanel: React.FC<ProcessingOptionsPanelProps> = ({
  photo: _photo,
  availableCredits,
  onOptionsChange,
  onProcess,
  isProcessing
}) => {
  const [options, setOptions] = useState<ProcessingOptions>({
    restore: false,
    colourize: false,
    animate: false,
    bringTogether: false,
    quality: 'standard'
  });

  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(null);
  // const [, _setIsCalculating] = useState(false); // TODO: Implement calculation state

  // Credit costs (from requirements)
  const creditCosts = useMemo(() => ({
    restore: 2,
    colourize: 3,
    animate: 8,
    bringTogether: 6
  }), []);

  // Calculate cost breakdown
  const calculateCost = useCallback((opts: ProcessingOptions): CostBreakdown => {
    const individualCosts = {
      restore: opts.restore ? creditCosts.restore : 0,
      colourize: opts.colourize ? creditCosts.colourize : 0,
      animate: opts.animate ? creditCosts.animate : 0,
      bringTogether: opts.bringTogether ? creditCosts.bringTogether : 0
    };

    const subtotal = Object.values(individualCosts).reduce((sum, cost) => sum + cost, 0);
    
    // Combined processing discount (1 credit off for restore + colourize)
    const combinedDiscount = (opts.restore && opts.colourize) ? 1 : 0;
    const totalCost = Math.max(0, subtotal - combinedDiscount);

    // Calculate credit usage (simplified - just use total credits)
    // const creditsUsed = Math.min(totalCost, availableCredits.totalCredits);

    return {
      individualCosts,
      subtotal,
      combinedDiscount,
      totalCost,
      availableCredits: availableCredits.totalCredits,
      remainingCredits: availableCredits.totalCredits - totalCost
    };
  }, [availableCredits, creditCosts]);

  // Update cost breakdown when options change
  React.useEffect(() => {
    const breakdown = calculateCost(options);
    setCostBreakdown(breakdown);
    onOptionsChange(options);
  }, [options, calculateCost, onOptionsChange]);

  // Handle option change
  const handleOptionChange = (option: keyof ProcessingOptions, value: boolean) => {
    setOptions(prev => ({
      ...prev,
      [option]: value
    }));
  };

  // Handle quality change
  const handleQualityChange = (quality: 'standard' | 'hd') => {
    setOptions(prev => ({
      ...prev,
      quality
    }));
  };

  // Handle process
  const handleProcess = () => {
    if (costBreakdown && costBreakdown.totalCost > 0) {
      onProcess(options);
    }
  };

  // Check if user can afford the selected options
  const canAfford = costBreakdown ? costBreakdown.totalCost <= availableCredits.totalCredits : false;
  const hasSelectedOptions = Object.values(options).some(value => 
    typeof value === 'boolean' ? value : false
  );

  return (
    <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
      <h3 className="text-md font-medium text-gray-900 mb-4">Processing Options</h3>
      
      {/* Processing Options */}
      <div className="space-y-3 mb-4">
        {/* Restore Option */}
        <label className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors touch-manipulation min-h-[48px]">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={options.restore}
              onChange={(e) => handleOptionChange('restore', e.target.checked)}
              disabled={isProcessing}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <span className="font-medium text-gray-900">Restore</span>
              <p className="text-sm text-gray-500">Fix damage, scratches, and imperfections</p>
            </div>
          </div>
          <span className="text-sm font-medium text-gray-600">{creditCosts.restore} credits</span>
        </label>

        {/* Colourize Option */}
        <label className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors touch-manipulation min-h-[48px]">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={options.colourize}
              onChange={(e) => handleOptionChange('colourize', e.target.checked)}
              disabled={isProcessing}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <span className="font-medium text-gray-900">Colourize</span>
              <p className="text-sm text-gray-500">Add realistic colors to black and white photos</p>
            </div>
          </div>
          <span className="text-sm font-medium text-gray-600">{creditCosts.colourize} credits</span>
        </label>

        {/* Animate Option (Post-MVP) */}
        <label className="flex items-center justify-between p-3 bg-gray-100 rounded-lg border border-gray-200 opacity-50">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              disabled
              className="w-4 h-4 text-gray-400 border-gray-300 rounded"
            />
            <div>
              <span className="font-medium text-gray-500">Animate</span>
              <p className="text-sm text-gray-400">Coming soon - Bring photos to life</p>
            </div>
          </div>
          <span className="text-sm font-medium text-gray-400">{creditCosts.animate} credits</span>
        </label>

        {/* Bring Together Option (Post-MVP) */}
        <label className="flex items-center justify-between p-3 bg-gray-100 rounded-lg border border-gray-200 opacity-50">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              disabled
              className="w-4 h-4 text-gray-400 border-gray-300 rounded"
            />
            <div>
              <span className="font-medium text-gray-500">Bring Together</span>
              <p className="text-sm text-gray-400">Coming soon - Combine multiple photos</p>
            </div>
          </div>
          <span className="text-sm font-medium text-gray-400">{creditCosts.bringTogether} credits</span>
        </label>
      </div>

      {/* Quality Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Quality</label>
        <div className="flex space-x-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="quality"
              value="standard"
              checked={options.quality === 'standard'}
              onChange={() => handleQualityChange('standard')}
              disabled={isProcessing}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Standard (480p)</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="quality"
              value="hd"
              checked={options.quality === 'hd'}
              onChange={() => handleQualityChange('hd')}
              disabled={isProcessing}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">HD (720p)</span>
          </label>
        </div>
      </div>

      {/* Cost Breakdown */}
      {costBreakdown && costBreakdown.totalCost > 0 && (
        <div className="bg-white rounded-lg p-3 mb-4 border border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Cost Breakdown</h4>
          
          {/* Individual Costs */}
          <div className="space-y-1 text-sm">
            {costBreakdown.individualCosts.restore > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Restore</span>
                <span className="text-gray-900">{costBreakdown.individualCosts.restore} credits</span>
              </div>
            )}
            {costBreakdown.individualCosts.colourize > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Colourize</span>
                <span className="text-gray-900">{costBreakdown.individualCosts.colourize} credits</span>
              </div>
            )}
            {costBreakdown.combinedDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Combined Discount</span>
                <span>-{costBreakdown.combinedDiscount} credit</span>
              </div>
            )}
          </div>
          
          <div className="border-t border-gray-200 mt-2 pt-2">
            <div className="flex justify-between font-medium">
              <span className="text-gray-900">Total Cost</span>
              <span className="text-gray-900">{costBreakdown.totalCost} credits</span>
            </div>
            
            {/* Credit Usage - Simplified */}
            <div className="mt-2 text-xs text-gray-500">
              <div>Total cost: {costBreakdown.totalCost} credits</div>
              <div>Remaining: {costBreakdown.remainingCredits} credits</div>
            </div>
          </div>
        </div>
      )}

      {/* Process Button */}
        <button
          onClick={handleProcess}
          disabled={!hasSelectedOptions || !canAfford || isProcessing}
          className={`w-full py-4 px-4 rounded-lg font-medium transition-colors touch-manipulation min-h-[48px] ${
            hasSelectedOptions && canAfford && !isProcessing
              ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          aria-label={hasSelectedOptions && canAfford ? 'Start processing photo' : 'Select processing options to continue'}
        >
        {isProcessing ? (
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Processing...</span>
          </div>
        ) : (
          `Process Photo${costBreakdown ? ` (${costBreakdown.totalCost} credits)` : ''}`
        )}
      </button>

      {/* Insufficient Credits Warning */}
      {!canAfford && hasSelectedOptions && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-sm text-red-700">
              Insufficient credits. You need {costBreakdown?.totalCost || 0} credits but only have {availableCredits.totalCredits}.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessingOptionsPanel;
