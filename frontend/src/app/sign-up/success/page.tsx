'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Container, Card, Headline, Body, Button } from '@/components/ui';

/**
 * Sign-Up Success Page
 *
 * Shown after successful sign-up to inform user to check their email
 * for confirmation (if email confirmation is enabled).
 */
function SignUpSuccessContent() {
  const searchParams = useSearchParams();
  const email = searchParams?.get('email') || '';
  const [displayEmail, setDisplayEmail] = useState('');

  useEffect(() => {
    if (email) {
      setDisplayEmail(decodeURIComponent(email));
    }
  }, [email]);

  return (
    <div className="min-h-screen bg-cozy-background flex items-center justify-center px-4 py-12">
      <Container className="w-full max-w-md">
        <Card className="p-8 text-center">
          {/* Success Icon */}
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 bg-cozy-mount rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-cozySemantic-success"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          {/* Success Message */}
          <Headline level={2} className="text-cozy-heading mb-4">
            Account Created Successfully!
          </Headline>

          <div className="mb-6 space-y-3">
            <Body className="text-cozy-text">
              {displayEmail ? (
                <>
                  We&apos;ve sent a confirmation email to{' '}
                  <span className="font-medium text-cozy-accentDark">{displayEmail}</span>
                </>
              ) : (
                <>We&apos;ve sent a confirmation email to your email address.</>
              )}
            </Body>
            <Body className="text-cozy-text text-sm">
              Please check your inbox and click the confirmation link to verify your account.
            </Body>
          </div>

          {/* Information Box */}
          <div className="bg-cozy-mount border border-cozy-borderCard rounded-cozy-md p-4 mb-6 text-left">
            <div className="flex items-start space-x-3">
              <svg
                className="w-5 h-5 text-cozy-accent flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-sm text-cozy-text">
                <p className="font-medium text-cozy-heading mb-1">Didn&apos;t receive the email?</p>
                <ul className="list-disc list-inside space-y-1 text-cozy-textSecondary">
                  <li>Check your spam/junk folder</li>
                  <li>Make sure you entered the correct email address</li>
                  <li>Wait a few minutes and check again</li>
                  <li>
                    Still nothing? Return to the{' '}
                    <Link href="/sign-in" className="text-cozy-accent hover:underline font-medium">
                      sign-in page
                    </Link>{' '}
                    to request a new link or contact{' '}
                    <a className="text-cozy-accent hover:underline font-medium" href="mailto:support@rekindle.app">
                      support@rekindle.app
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button href="/sign-in" variant="primary" fullWidth size="large">
              Continue to Sign In
            </Button>
            <Button href="/" variant="secondary" fullWidth>
              Back to Home
            </Button>
          </div>
        </Card>

        {/* Footer */}
          <div className="mt-8 text-center">
          <Body className="text-cozy-textSecondary text-sm">
            Need help?{' '}
            <a href="mailto:support@rekindle.app" className="text-cozy-accent hover:underline">
              Contact Support
            </a>
          </Body>
        </div>
      </Container>
    </div>
  );
}

export default function SignUpSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-cozy-background flex items-center justify-center">
          <div className="text-cozy-textSecondary">Loading...</div>
        </div>
      }
    >
      <SignUpSuccessContent />
    </Suspense>
  );
}
