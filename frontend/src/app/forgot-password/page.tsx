'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Container, Card, Headline, Body, Button } from '@/components/ui';

const inputClasses =
  'w-full px-4 py-3 border border-cozy-borderCard rounded-cozy-input bg-cozy-surface text-cozy-text font-serif text-cozy-body placeholder:text-cozy-textMuted focus:outline-none focus-visible:ring-2 focus-visible:ring-cozy-accent focus-visible:border-cozy-accent transition-colors disabled:bg-cozy-mount disabled:cursor-not-allowed';

export default function ForgotPasswordPage() {
  const { resetPassword, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      const { error: resetError } = await resetPassword(email);

      if (resetError) {
        setError(resetError.message || 'We could not send a reset email. Please try again shortly.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-cozy-background flex items-center justify-center px-4 py-12">
      <Container className="max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-4">
            <Headline level={1} className="text-cozy-accent">Rekindle</Headline>
          </Link>
          <Headline level={2} className="mb-2">Reset your password</Headline>
          <Body>
            Enter the email you use for Rekindle and we&apos;ll send a link to create a new password.
          </Body>
        </div>

        <Card className="p-8 space-y-6">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 border-cozySemantic-success bg-cozy-mount">
                <svg className="h-6 w-6 text-cozySemantic-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <Headline level={3}>Check your inbox</Headline>
              <Body>
                If an account exists for <span className="font-medium text-cozy-heading">{email}</span>, you will receive an email with a reset
                link. The link expires after a short period for security.
              </Body>
              <p className="text-sm text-cozy-textSecondary">Didn&apos;t get the email? Be sure to check spam or try again.</p>
              <div className="space-y-2">
                <Button
                  variant="secondary"
                  fullWidth
                  type="button"
                  onClick={() => {
                    setSuccess(false);
                    setEmail('');
                  }}
                >
                  Send another link
                </Button>
                <Button href="/sign-in" variant="primary" fullWidth>
                  Return to sign in
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-cozy-md border border-cozySemantic-error bg-cozy-mount p-4 text-sm text-cozy-text" role="alert">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-cozy-heading font-serif">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={loading}
                  placeholder="you@example.com"
                  className={inputClasses}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="large"
                fullWidth
                disabled={loading}
                className="flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V2.5A9.5 9.5 0 002.5 12H4zm2 5.196A7.964 7.964 0 014 12H2.5a9.5 9.5 0 0011 9.45V20a8 8 0 01-7.5-2.804z"
                      ></path>
                    </svg>
                    <span>Sending link...</span>
                  </>
                ) : (
                  <span>Send reset link</span>
                )}
              </Button>

              <div className="text-center text-sm text-cozy-textSecondary">
                Remembered your password?{' '}
                <Link href="/sign-in" className="text-cozy-accent font-medium hover:underline">
                  Return to sign in
                </Link>
              </div>
            </form>
          )}
        </Card>
      </Container>
    </div>
  );
}



