'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

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
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-4">
            <h1 className="text-3xl font-bold text-blue-600">Rekindle</h1>
          </Link>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Reset your password</h2>
          <p className="text-gray-600">
            Enter the email you use for Rekindle and we&apos;ll send a link to create a new password.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Check your inbox</h3>
              <p className="text-gray-600">
                If an account exists for <span className="font-medium text-gray-900">{email}</span>, you will receive an email with a reset
                link. The link expires after a short period for security.
              </p>
              <p className="text-sm text-gray-500">Didn&apos;t get the email? Be sure to check spam or try again.</p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setSuccess(false);
                    setEmail('');
                  }}
                  className="w-full rounded-lg border border-blue-600 px-4 py-2 text-blue-600 font-medium hover:bg-blue-50 transition"
                >
                  Send another link
                </button>
                <Link
                  href="/sign-in"
                  className="block text-center w-full rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 transition"
                >
                  Return to sign in
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
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
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
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
              </button>

              <div className="text-center text-sm text-gray-600">
                Remembered your password?{' '}
                <Link href="/sign-in" className="text-blue-600 font-medium hover:text-blue-700 hover:underline">
                  Return to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}



