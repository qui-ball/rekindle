import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProcessingParameterDrawer } from '../ProcessingParameterDrawer';
import { RestoreParameters, AnimateParameters, BringTogetherParameters } from '../../../types/photo-management';

describe('ProcessingParameterDrawer', () => {
  // Restore Parameters Tests
  describe('Restore Parameters', () => {
    const mockRestoreParams: RestoreParameters = {
      colourize: false,
      denoiseLevel: 0.7,
      userPrompt: ''
    };

    it('should render when open', () => {
      render(
        <ProcessingParameterDrawer
          processingType="restore"
          isOpen={true}
          parameters={mockRestoreParams}
          onParametersChange={jest.fn()}
          advancedOptionsOpen={false}
          onToggleAdvancedOptions={jest.fn()}
        />
      );

      expect(screen.getByText('Common Parameters')).toBeInTheDocument();
      expect(screen.getByLabelText(/colourize/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      const { container } = render(
        <ProcessingParameterDrawer
          processingType="restore"
          isOpen={false}
          parameters={mockRestoreParams}
          onParametersChange={jest.fn()}
          advancedOptionsOpen={false}
          onToggleAdvancedOptions={jest.fn()}
        />
      );

      // Check that the drawer has max-h-0 and opacity-0 classes when closed
      const drawer = container.firstChild as HTMLElement;
      expect(drawer).toHaveClass('max-h-0');
      expect(drawer).toHaveClass('opacity-0');
    });

    it('should have slide-down animation classes when open', () => {
      const { container } = render(
        <ProcessingParameterDrawer
          processingType="restore"
          isOpen={true}
          parameters={mockRestoreParams}
          onParametersChange={jest.fn()}
          advancedOptionsOpen={false}
          onToggleAdvancedOptions={jest.fn()}
        />
      );

      const drawer = container.firstChild as HTMLElement;
      expect(drawer).toHaveClass('max-h-[600px]');
      expect(drawer).toHaveClass('opacity-100');
      expect(drawer).toHaveClass('transition-all');
    });

    it('should handle colourize checkbox change', () => {
      const mockOnChange = jest.fn();
      render(
        <ProcessingParameterDrawer
          processingType="restore"
          isOpen={true}
          parameters={mockRestoreParams}
          onParametersChange={mockOnChange}
          advancedOptionsOpen={false}
          onToggleAdvancedOptions={jest.fn()}
        />
      );

      const colourizeCheckbox = screen.getByRole('checkbox', { name: /colourize/i });
      fireEvent.click(colourizeCheckbox);

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockRestoreParams,
        colourize: true
      });
    });

    it('should display denoise level slider in advanced options', () => {
      render(
        <ProcessingParameterDrawer
          processingType="restore"
          isOpen={true}
          parameters={mockRestoreParams}
          onParametersChange={jest.fn()}
          advancedOptionsOpen={true}
          onToggleAdvancedOptions={jest.fn()}
        />
      );

      expect(screen.getByText(/Denoise Level:/)).toBeInTheDocument();
      expect(screen.getByDisplayValue('0.7')).toBeInTheDocument();
    });

    it('should handle denoise level change', () => {
      const mockOnChange = jest.fn();
      render(
        <ProcessingParameterDrawer
          processingType="restore"
          isOpen={true}
          parameters={mockRestoreParams}
          onParametersChange={mockOnChange}
          advancedOptionsOpen={true}
          onToggleAdvancedOptions={jest.fn()}
        />
      );

      const slider = screen.getByDisplayValue('0.7');
      fireEvent.change(slider, { target: { value: '0.85' } });

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockRestoreParams,
        denoiseLevel: 0.85
      });
    });

    it('should display denoise level with correct range (0.5-0.9)', () => {
      render(
        <ProcessingParameterDrawer
          processingType="restore"
          isOpen={true}
          parameters={mockRestoreParams}
          onParametersChange={jest.fn()}
          advancedOptionsOpen={true}
          onToggleAdvancedOptions={jest.fn()}
        />
      );

      const slider = screen.getByDisplayValue('0.7') as HTMLInputElement;
      expect(slider).toHaveAttribute('min', '0.5');
      expect(slider).toHaveAttribute('max', '0.9');
      expect(slider).toHaveAttribute('step', '0.01');
    });

    it('should handle user prompt change', () => {
      const mockOnChange = jest.fn();
      render(
        <ProcessingParameterDrawer
          processingType="restore"
          isOpen={true}
          parameters={mockRestoreParams}
          onParametersChange={mockOnChange}
          advancedOptionsOpen={true}
          onToggleAdvancedOptions={jest.fn()}
        />
      );

      const textarea = screen.getByPlaceholderText(/Focus on face details/i);
      fireEvent.change(textarea, { target: { value: 'Test prompt' } });

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockRestoreParams,
        userPrompt: 'Test prompt'
      });
    });

    it('should toggle advanced options', () => {
      const mockToggle = jest.fn();
      render(
        <ProcessingParameterDrawer
          processingType="restore"
          isOpen={true}
          parameters={mockRestoreParams}
          onParametersChange={jest.fn()}
          advancedOptionsOpen={false}
          onToggleAdvancedOptions={mockToggle}
        />
      );

      const advancedButton = screen.getByRole('button', { name: /advanced options/i });
      fireEvent.click(advancedButton);

      expect(mockToggle).toHaveBeenCalled();
    });
  });

  // Animate Parameters Tests
  describe('Animate Parameters', () => {
    const mockAnimateParams: AnimateParameters = {
      videoDuration: 15,
      userPrompt: ''
    };

    it('should render video duration slider', () => {
      render(
        <ProcessingParameterDrawer
          processingType="animate"
          isOpen={true}
          parameters={mockAnimateParams}
          onParametersChange={jest.fn()}
          advancedOptionsOpen={false}
          onToggleAdvancedOptions={jest.fn()}
        />
      );

      expect(screen.getByText(/Video Duration: 15 seconds/)).toBeInTheDocument();
    });

    it('should have correct video duration range (5-30 seconds)', () => {
      render(
        <ProcessingParameterDrawer
          processingType="animate"
          isOpen={true}
          parameters={mockAnimateParams}
          onParametersChange={jest.fn()}
          advancedOptionsOpen={false}
          onToggleAdvancedOptions={jest.fn()}
        />
      );

      const slider = screen.getByDisplayValue('15') as HTMLInputElement;
      expect(slider).toHaveAttribute('min', '5');
      expect(slider).toHaveAttribute('max', '30');
    });

    it('should handle video duration change', () => {
      const mockOnChange = jest.fn();
      render(
        <ProcessingParameterDrawer
          processingType="animate"
          isOpen={true}
          parameters={mockAnimateParams}
          onParametersChange={mockOnChange}
          advancedOptionsOpen={false}
          onToggleAdvancedOptions={jest.fn()}
        />
      );

      const slider = screen.getByDisplayValue('15');
      fireEvent.change(slider, { target: { value: '20' } });

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockAnimateParams,
        videoDuration: 20
      });
    });

    it('should display duration markers (5s, 15s, 30s)', () => {
      render(
        <ProcessingParameterDrawer
          processingType="animate"
          isOpen={true}
          parameters={mockAnimateParams}
          onParametersChange={jest.fn()}
          advancedOptionsOpen={false}
          onToggleAdvancedOptions={jest.fn()}
        />
      );

      expect(screen.getByText('5s')).toBeInTheDocument();
      expect(screen.getByText('15s')).toBeInTheDocument();
      expect(screen.getByText('30s')).toBeInTheDocument();
    });

    it('should display cost range (10-50 credits)', () => {
      render(
        <ProcessingParameterDrawer
          processingType="animate"
          isOpen={true}
          parameters={mockAnimateParams}
          onParametersChange={jest.fn()}
          advancedOptionsOpen={false}
          onToggleAdvancedOptions={jest.fn()}
        />
      );

      expect(screen.getByText(/10-50 credits/)).toBeInTheDocument();
    });

    it('should handle user prompt in advanced options', () => {
      const mockOnChange = jest.fn();
      render(
        <ProcessingParameterDrawer
          processingType="animate"
          isOpen={true}
          parameters={mockAnimateParams}
          onParametersChange={mockOnChange}
          advancedOptionsOpen={true}
          onToggleAdvancedOptions={jest.fn()}
        />
      );

      const textarea = screen.getByPlaceholderText(/Make eyes blink/i);
      fireEvent.change(textarea, { target: { value: 'Animate smoothly' } });

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockAnimateParams,
        userPrompt: 'Animate smoothly'
      });
    });
  });

  // Bring Together Parameters Tests
  describe('Bring Together Parameters', () => {
    const mockBringTogetherParams: BringTogetherParameters = {};

    it('should render placeholder message', () => {
      render(
        <ProcessingParameterDrawer
          processingType="bringTogether"
          isOpen={true}
          parameters={mockBringTogetherParams}
          onParametersChange={jest.fn()}
          advancedOptionsOpen={false}
          onToggleAdvancedOptions={jest.fn()}
        />
      );

      expect(screen.getByText(/Parameters for Bring Together will be available soon/i)).toBeInTheDocument();
    });
  });

  // Animation Tests
  describe('Drawer Animations', () => {
    it('should have transition classes', () => {
      const { container } = render(
        <ProcessingParameterDrawer
          processingType="restore"
          isOpen={true}
          parameters={{ colourize: false, denoiseLevel: 0.7, userPrompt: '' }}
          onParametersChange={jest.fn()}
          advancedOptionsOpen={false}
          onToggleAdvancedOptions={jest.fn()}
        />
      );

      const drawer = container.firstChild as HTMLElement;
      expect(drawer).toHaveClass('transition-all');
      expect(drawer).toHaveClass('duration-300');
      expect(drawer).toHaveClass('ease-in-out');
    });

    it('should animate advanced options section', () => {
      // Test that advanced options toggle exists
      const { rerender } = render(
        <ProcessingParameterDrawer
          processingType="restore"
          isOpen={true}
          parameters={{ colourize: false, denoiseLevel: 0.7, userPrompt: '' }}
          onParametersChange={jest.fn()}
          advancedOptionsOpen={false}
          onToggleAdvancedOptions={jest.fn()}
        />
      );

      // Advanced options button should exist
      expect(screen.getByText('Advanced Options')).toBeInTheDocument();

      // Rerender with advanced options open
      rerender(
        <ProcessingParameterDrawer
          processingType="restore"
          isOpen={true}
          parameters={{ colourize: false, denoiseLevel: 0.7, userPrompt: '' }}
          onParametersChange={jest.fn()}
          advancedOptionsOpen={true}
          onToggleAdvancedOptions={jest.fn()}
        />
      );

      // Advanced content should be visible
      expect(screen.getByText(/Denoise Level:/i)).toBeInTheDocument();
    });
  });
});

