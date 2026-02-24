'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { 
  ProcessingOptionsPanelProps, 
  ProcessingOptions, 
  CostBreakdown,
  RestoreParameters,
  AnimateParameters,
  BringTogetherParameters
} from '../../types/photo-management';
import ProcessingParameterDrawer from './ProcessingParameterDrawer';
import { Headline, Body, Caption, Button } from '@/components/ui';

/**
 * ProcessingOptionsPanel Component
 * 
 * Interactive panel for selecting processing options with real-time credit calculation.
 * Features:
 * - Dynamic checkbox options based on available credits
 * - Real-time credit cost calculation with parameter-based pricing
 * - Parameter drawers for each processing type
 * - Disabled state for unaffordable options
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
    animate: false,
    bringTogether: false,
    quality: 'standard',
    parameters: {
      restore: { colourize: false, denoiseLevel: 0.7, userPrompt: '' },
      animate: { videoDuration: 15, userPrompt: '' }, // Default to middle value
      bringTogether: {}
    }
  });

  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(null);
  
  // Advanced options state for each drawer
  const [advancedOptionsOpen, setAdvancedOptionsOpen] = useState({
    restore: false,
    animate: false,
    bringTogether: false
  });

  // Credit costs (updated pricing model)
  const creditCosts = useMemo(() => ({
    restore: 2, // Base restore cost
    restoreWithColourize: 2, // Additional cost when colourize parameter is enabled (total: 4 credits)
    animateBase: 10, // Base animate cost (5 seconds)
    animatePerSecond: 1.6, // Cost per second over 5 seconds
    bringTogether: 6
  }), []);

  // Calculate dynamic animate cost based on video duration
  const calculateAnimateCost = useCallback((duration: number): number => {
    // Formula: 10 + ceil((duration - 5) * 1.6)
    // 5 seconds = 10 credits, 15 seconds = 26 credits, 30 seconds = 50 credits
    return creditCosts.animateBase + Math.ceil((duration - 5) * creditCosts.animatePerSecond);
  }, [creditCosts]);

  // Calculate cost breakdown
  const calculateCost = useCallback((opts: ProcessingOptions): CostBreakdown => {
    const individualCosts = {
      restore: 0,
      colourize: 0, // Keep for backward compatibility in breakdown display
      animate: 0,
      bringTogether: 0
    };

    // Restore cost (base + colourize if enabled)
    if (opts.restore) {
      individualCosts.restore = creditCosts.restore;
      if (opts.parameters?.restore?.colourize) {
        individualCosts.restore += creditCosts.restoreWithColourize;
        individualCosts.colourize = creditCosts.restoreWithColourize; // For display
      }
    }

    // Animate cost (dynamic based on video duration)
    if (opts.animate) {
      const videoDuration = opts.parameters?.animate?.videoDuration || 15;
      individualCosts.animate = calculateAnimateCost(videoDuration);
    }

    // Bring Together cost
    if (opts.bringTogether) {
      individualCosts.bringTogether = creditCosts.bringTogether;
    }

    const subtotal = individualCosts.restore + individualCosts.animate + individualCosts.bringTogether;
    
    // No more combined discount (removed per requirements)
    const combinedDiscount = 0;
    const totalCost = subtotal;

    return {
      individualCosts,
      subtotal,
      combinedDiscount,
      totalCost,
      availableCredits: availableCredits.totalCredits,
      remainingCredits: availableCredits.totalCredits - totalCost
    };
  }, [availableCredits, creditCosts, calculateAnimateCost]);

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

  // Handle parameter changes for each processing type (drawer passes union type)
  const handleRestoreParametersChange = (params: RestoreParameters | AnimateParameters | BringTogetherParameters) => {
    if (!('colourize' in params)) return;
    setOptions(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        restore: params as RestoreParameters
      }
    }));
  };

  const handleAnimateParametersChange = (params: RestoreParameters | AnimateParameters | BringTogetherParameters) => {
    if (!('videoDuration' in params)) return;
    setOptions(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        animate: params as AnimateParameters
      }
    }));
  };

  const handleBringTogetherParametersChange = (params: RestoreParameters | AnimateParameters | BringTogetherParameters) => {
    if ('colourize' in params || 'videoDuration' in params) return;
    setOptions(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        bringTogether: params as BringTogetherParameters
      }
    }));
  };

  // Handle advanced options toggle
  const handleToggleAdvancedOptions = (processingType: keyof typeof advancedOptionsOpen) => {
    setAdvancedOptionsOpen(prev => ({
      ...prev,
      [processingType]: !prev[processingType]
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
  const hasSelectedOptions = options.restore || options.animate || options.bringTogether;

  return (
    <div className="bg-cozy-mount rounded-cozy-lg border border-cozy-borderCard p-4 sm:p-6">
      <Headline level={3} className="text-cozy-heading mb-4">Processing Options</Headline>
      
      {/* Processing Options */}
      <div className="space-y-2 mb-4">
        {/* Restore Option */}
        <div>
          <label className="flex items-center justify-between p-3 bg-cozy-surface rounded-cozy-lg border border-cozy-borderCard hover:border-cozy-accent transition-colors touch-manipulation min-h-[48px] cursor-pointer">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={options.restore}
                onChange={(e) => handleOptionChange('restore', e.target.checked)}
                disabled={isProcessing}
                className="w-5 h-5 text-cozy-accent border-cozy-borderCard rounded focus:ring-cozy-accent"
              />
              <div>
                <span className="font-medium text-cozy-heading">Restore</span>
                <Body className="text-sm text-cozy-text">Fix damage, scratches, and imperfections</Body>
              </div>
            </div>
            <span className="text-sm font-medium text-cozy-text">{creditCosts.restore}+ credits</span>
          </label>
          
          {/* Restore Parameter Drawer */}
          <ProcessingParameterDrawer
            processingType="restore"
            isOpen={options.restore}
            parameters={options.parameters?.restore || { colourize: false }}
            onParametersChange={handleRestoreParametersChange}
            advancedOptionsOpen={advancedOptionsOpen.restore}
            onToggleAdvancedOptions={() => handleToggleAdvancedOptions('restore')}
          />
        </div>

        {/* Animate Option */}
        <div>
          <label className="flex items-center justify-between p-3 bg-cozy-surface rounded-cozy-lg border border-cozy-borderCard hover:border-cozy-accent transition-colors touch-manipulation min-h-[48px] cursor-pointer">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={options.animate}
                onChange={(e) => handleOptionChange('animate', e.target.checked)}
                disabled={isProcessing}
                className="w-5 h-5 text-cozy-accent border-cozy-borderCard rounded focus:ring-cozy-accent"
              />
              <div>
                <span className="font-medium text-cozy-heading">Animate</span>
                <Body className="text-sm text-cozy-text">Bring photos to life with motion</Body>
              </div>
            </div>
            <span className="text-sm font-medium text-cozy-text">
              {options.animate 
                ? `${calculateAnimateCost(options.parameters?.animate?.videoDuration || 15)} credits`
                : '10-50 credits'
              }
            </span>
          </label>
          
          {/* Animate Parameter Drawer */}
          <ProcessingParameterDrawer
            processingType="animate"
            isOpen={options.animate}
            parameters={options.parameters?.animate || { videoDuration: 5 }}
            onParametersChange={handleAnimateParametersChange}
            advancedOptionsOpen={advancedOptionsOpen.animate}
            onToggleAdvancedOptions={() => handleToggleAdvancedOptions('animate')}
          />
        </div>

        {/* Bring Together Option (Post-MVP) */}
        <div>
          <label className="flex items-center justify-between p-3 bg-cozy-mount rounded-cozy-lg border border-cozy-borderCard opacity-60 cursor-not-allowed">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                disabled
                className="w-4 h-4 text-cozy-textMuted border-cozy-borderCard rounded"
              />
              <div>
                <span className="font-medium text-cozy-textMuted">Bring Together</span>
                <Body className="text-sm text-cozy-textMuted">Coming soon - Combine multiple photos</Body>
              </div>
            </div>
            <span className="text-sm font-medium text-cozy-textMuted">{creditCosts.bringTogether} credits</span>
          </label>
          
          {/* Bring Together Parameter Drawer (disabled for MVP) */}
          {options.bringTogether && (
            <ProcessingParameterDrawer
              processingType="bringTogether"
              isOpen={options.bringTogether}
              parameters={options.parameters?.bringTogether || {}}
              onParametersChange={handleBringTogetherParametersChange}
              advancedOptionsOpen={advancedOptionsOpen.bringTogether}
              onToggleAdvancedOptions={() => handleToggleAdvancedOptions('bringTogether')}
            />
          )}
        </div>
      </div>

      {/* Quality Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-cozy-heading mb-2">Quality</label>
        <div className="flex space-x-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="quality"
              value="standard"
              checked={options.quality === 'standard'}
              onChange={() => handleQualityChange('standard')}
              disabled={isProcessing}
              className="w-4 h-4 text-cozy-accent border-cozy-borderCard focus:ring-cozy-accent"
            />
            <span className="ml-2 text-sm text-cozy-text">Standard (480p)</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="quality"
              value="hd"
              checked={options.quality === 'hd'}
              onChange={() => handleQualityChange('hd')}
              disabled={isProcessing}
              className="w-4 h-4 text-cozy-accent border-cozy-borderCard focus:ring-cozy-accent"
            />
            <span className="ml-2 text-sm text-cozy-text">HD (720p)</span>
          </label>
        </div>
      </div>

      {/* Cost Breakdown */}
      {costBreakdown && costBreakdown.totalCost > 0 && (
        <div className="bg-cozy-surface rounded-cozy-lg p-3 mb-4 border border-cozy-borderCard">
          <Headline level={3} as="h4" className="text-cozy-heading text-sm mb-2">Cost Breakdown</Headline>
          
          {/* Individual Costs */}
          <div className="space-y-1 text-sm">
            {costBreakdown.individualCosts.restore > 0 && (
              <div className="flex justify-between">
                <span className="text-cozy-text">
                  Restore{options.parameters?.restore?.colourize ? ' + Colourize' : ''}
                </span>
                <span className="text-cozy-accent">{costBreakdown.individualCosts.restore} credits</span>
              </div>
            )}
            {costBreakdown.individualCosts.animate > 0 && (
              <div className="flex justify-between">
                <span className="text-cozy-text">
                  Animate ({options.parameters?.animate?.videoDuration || 15}s)
                </span>
                <span className="text-cozy-accent">{costBreakdown.individualCosts.animate} credits</span>
              </div>
            )}
            {costBreakdown.individualCosts.bringTogether > 0 && (
              <div className="flex justify-between">
                <span className="text-cozy-text">Bring Together</span>
                <span className="text-cozy-accent">{costBreakdown.individualCosts.bringTogether} credits</span>
              </div>
            )}
          </div>
          
          <div className="border-t border-cozy-borderCard mt-2 pt-2">
            <div className="flex justify-between font-medium">
              <span className="text-cozy-heading">Total Cost</span>
              <span className="text-cozy-accent">{costBreakdown.totalCost} credits</span>
            </div>
            
            {/* Credit Usage */}
            <div className="mt-2">
              <Caption className="text-cozy-text">Available: {costBreakdown.availableCredits} credits</Caption>
              <Caption className="text-cozy-text">Remaining after: {costBreakdown.remainingCredits} credits</Caption>
            </div>
          </div>
        </div>
      )}

      {/* Process Button */}
      <Button
        type="button"
        variant="primary"
        size="large"
        fullWidth
        onClick={handleProcess}
        disabled={!hasSelectedOptions || !canAfford || isProcessing}
        className="touch-manipulation min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed"
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
      </Button>

      {/* Insufficient Credits Warning */}
      {!canAfford && hasSelectedOptions && (
        <div className="mt-3 p-3 bg-cozySemantic-error/10 border border-cozySemantic-error/30 rounded-cozy-lg">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-cozySemantic-error flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <Body className="text-sm text-cozySemantic-error">
              Insufficient credits. You need {costBreakdown?.totalCost || 0} credits but only have {availableCredits.totalCredits}.
            </Body>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessingOptionsPanel;
