'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Container, Card, Headline, Body, Button } from '@/components/ui';

/**
 * Terms Acceptance Page
 * 
 * Shown after OAuth sign-up for new users who haven't accepted terms yet.
 * Users must explicitly accept terms before they can access the app.
 */
export default function AcceptTermsPage() {
  const router = useRouter();
  const { user, acceptTerms, loading: authLoading } = useAuth();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if user is not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/sign-in');
    }
  }, [user, authLoading, router]);

  // Check if user has already accepted terms
  useEffect(() => {
    if (user && user.user_metadata?.accepted_terms) {
      // User has already accepted terms, redirect to intended destination or upload page
      const searchParams = new URLSearchParams(window.location.search);
      const next = searchParams.get('next') || '/upload';
      router.push(next);
    }
  }, [user, router]);

  const handleAcceptTerms = async () => {
    if (!acceptedTerms) {
      setError('You must accept the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: acceptError } = await acceptTerms();
      
      if (acceptError) {
        setError(acceptError.message || 'Failed to accept terms. Please try again.');
        setIsLoading(false);
        return;
      }

      // Success - redirect to intended destination or upload page
      const searchParams = new URLSearchParams(window.location.search);
      const next = searchParams.get('next') || '/upload';
      router.push(next);
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  // Show loading state while checking auth
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-cozy-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cozy-accent mx-auto mb-4" aria-hidden="true" />
          <p className="text-cozy-textSecondary" role="status" aria-live="polite">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if user has already accepted terms (will redirect)
  if (user.user_metadata?.accepted_terms) {
    return null;
  }

  const isLoadingState = isLoading || authLoading;

  return (
    <div className="min-h-screen bg-cozy-background flex items-center justify-center px-4 py-12">
      <Container className="max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-4">
            <Headline level={1} className="text-cozy-accent">Rekindle</Headline>
          </Link>
          <Headline level={2} className="mb-2">Welcome!</Headline>
          <Body>Please accept our terms to continue.</Body>
        </div>

        {/* Terms Acceptance Card */}
        <Card className="p-8">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-cozy-mount border border-cozySemantic-error rounded-cozy-md" role="alert">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-cozySemantic-error shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <p className="text-sm text-cozy-text">{error}</p>
              </div>
            </div>
          )}

          {/* Terms of Service Checkbox */}
          <div className="mb-6">
            <div className="flex items-start space-x-3 mb-4">
              <input
                id="terms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                disabled={isLoadingState}
                required
                className="mt-1 h-5 w-5 text-cozy-accent border-cozy-borderCard rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-cozy-accent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <label htmlFor="terms" className="text-sm text-cozy-text">
                I agree to the{' '}
                <Link href="/terms" target="_blank" className="text-cozy-accent hover:underline font-medium">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" target="_blank" className="text-cozy-accent hover:underline font-medium">
                  Privacy Policy
                </Link>
              </label>
            </div>
          </div>

          {/* Accept Button */}
          <Button
            type="button"
            variant="primary"
            size="large"
            fullWidth
            onClick={handleAcceptTerms}
            disabled={isLoadingState || !acceptedTerms}
            className="flex items-center justify-center gap-2"
          >
            {isLoadingState ? (
              <>
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span>Accepting...</span>
              </>
            ) : (
              <span>Accept and Continue</span>
            )}
          </Button>
        </Card>
      </Container>
    </div>
  );
}

