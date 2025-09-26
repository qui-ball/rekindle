/**
 * LandscapeTest Component Tests
 * 
 * Tests the landscape mode detection functionality
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LandscapeTest } from './LandscapeTest';

describe('LandscapeTest', () => {
  beforeEach(() => {
    // Reset window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });
  });

  it('should render landscape test component', () => {
    render(<LandscapeTest />);
    
    expect(screen.getByText('Landscape Mode Test')).toBeInTheDocument();
    expect(screen.getByText('Current State:')).toBeInTheDocument();
  });

  it('should detect portrait mode on desktop', () => {
    render(<LandscapeTest />);
    
    expect(screen.getByText('PORTRAIT MODE')).toBeInTheDocument();
    expect(screen.getByText('Is Mobile: No')).toBeInTheDocument();
    expect(screen.getByText('Is Landscape: No')).toBeInTheDocument();
  });

  it('should detect landscape mode on mobile devices', () => {
    // Set mobile landscape dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 667, // Mobile width in landscape
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 375, // Mobile height in landscape
    });

    render(<LandscapeTest />);

    // Trigger resize event
    fireEvent(window, new Event('resize'));

    expect(screen.getByText('LANDSCAPE MODE')).toBeInTheDocument();
    expect(screen.getByText('Is Mobile: Yes')).toBeInTheDocument();
    expect(screen.getByText('Is Landscape: Yes')).toBeInTheDocument();
  });

  it('should detect portrait mode on mobile devices', () => {
    // Set mobile portrait dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375, // Mobile width in portrait
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 667, // Mobile height in portrait
    });

    render(<LandscapeTest />);

    // Trigger resize event
    fireEvent(window, new Event('resize'));

    expect(screen.getByText('PORTRAIT MODE')).toBeInTheDocument();
    expect(screen.getByText('Is Mobile: Yes')).toBeInTheDocument();
    expect(screen.getByText('Is Landscape: No')).toBeInTheDocument();
  });

  it('should respond to orientation changes', () => {
    render(<LandscapeTest />);

    // Start in portrait
    expect(screen.getByText('PORTRAIT MODE')).toBeInTheDocument();

    // Change to mobile landscape
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 667,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 375,
    });

    // Trigger orientation change event
    fireEvent(window, new Event('orientationchange'));

    expect(screen.getByText('LANDSCAPE MODE')).toBeInTheDocument();
  });
});