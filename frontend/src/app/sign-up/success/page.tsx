'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Sign-Up Success Page
 * 
 * Shown after successful sign-up to inform user to check their email
 * for confirmation (if email confirmation is enabled).
 */
export default function SignUpSuccessPage() {
  const searchParams = useSearchParams();
  const email = searchParams?.get('email') || '';
  const [displayEmail, setDisplayEmail] = useState('');

  useEffect(() => {
    if (email) {
      setDisplayEmail(decodeURIComponent(email));
    }
  }, [email]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Success Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          {/* Success Icon */}
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-600"
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
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">
            Account Created Successfully!
          </h1>

          <div className="mb-6 space-y-3">
            <p className="text-gray-600">
              {displayEmail ? (
                <>
                  We've sent a confirmation email to{' '}
                  <span className="font-medium text-gray-900">{displayEmail}</span>
                </>
              ) : (
                "We've sent a confirmation email to your email address."
              )}
            </p>
            <p className="text-sm text-gray-600">
              Please check your inbox and click the confirmation link to verify your account.
            </p>
          </div>

          {/* Information Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <div className="flex items-start space-x-3">
              <svg
                className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
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
              <div className="text-sm text-gray-700">
                <p className="font-medium text-gray-900 mb-1">Didn't receive the email?</p>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li>Check your spam/junk folder</li>
                  <li>Make sure you entered the correct email address</li>
                  <li>Wait a few minutes and check again</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link
              href="/sign-in"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors text-center"
            >
              Continue to Sign In
            </Link>
            <Link
              href="/"
              className="block w-full text-gray-600 hover:text-gray-900 font-medium py-2 px-4 rounded-lg transition-colors text-center"
            >
              Back to Home
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>
            Need help?{' '}
            <Link href="/support" className="text-blue-600 hover:underline">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

