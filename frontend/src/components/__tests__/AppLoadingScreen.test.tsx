// Tests for AppLoadingScreen component (now used only for critical errors)
import { render, screen } from '@testing-library/react';
import { AppLoadingScreen } from '../AppLoadingScreen';

describe('AppLoadingScreen', () => {
  it('should render error state correctly', () => {
    render(
      <AppLoadingScreen
        progress={50}
        message="App ready with basic features"
        status="fallback"
        error="Failed to load OpenCV"
      />
    );

    expect(screen.getByText('Rekindle')).toBeInTheDocument();
    expect(screen.getByText('Bring Your Memories to Life')).toBeInTheDocument();
    expect(screen.getByText('⚠️ App Loading Issue')).toBeInTheDocument();
    expect(screen.getByText('App ready with basic features')).toBeInTheDocument();
    expect(screen.getByText('Failed to load OpenCV')).toBeInTheDocument();
    expect(screen.getByText('Reload App')).toBeInTheDocument();
  });

  it('should render with message only', () => {
    render(
      <AppLoadingScreen
        progress={0}
        message="Critical error occurred"
        status="loading"
      />
    );

    expect(screen.getByText('Critical error occurred')).toBeInTheDocument();
    expect(screen.getByText('Reload App')).toBeInTheDocument();
  });
});