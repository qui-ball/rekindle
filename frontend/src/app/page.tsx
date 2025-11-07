'use client';

import Link from 'next/link';

/**
 * Landing Page
 * 
 * Simple landing page with sign-in and sign-up links.
 * This is the default route users see when they first visit the app.
 */
export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl text-center">
        {/* Logo/Title */}
        <div className="mb-12">
          <h1 className="text-5xl font-bold text-blue-600 mb-4">Rekindle</h1>
          <p className="text-2xl text-gray-700 mb-2">Restore Your Memories</p>
          <p className="text-lg text-gray-600">
            Transform old, damaged, or faded family photos into vibrant, restored memories with professional-grade AI.
          </p>
        </div>

        {/* Value Proposition */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div>
              <div className="text-3xl mb-2">✨</div>
              <h3 className="font-semibold text-gray-900 mb-2">AI-Powered Restoration</h3>
              <p className="text-sm text-gray-600">
                Advanced AI technology restores your photos to their original beauty
              </p>
            </div>
            <div>
              <div className="text-3xl mb-2">🎨</div>
              <h3 className="font-semibold text-gray-900 mb-2">Color & Enhance</h3>
              <p className="text-sm text-gray-600">
                Add color to black and white photos and enhance image quality
              </p>
            </div>
            <div>
              <div className="text-3xl mb-2">📸</div>
              <h3 className="font-semibold text-gray-900 mb-2">Easy Upload</h3>
              <p className="text-sm text-gray-600">
                Simple, secure photo upload and processing workflow
              </p>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-lg"
            >
              Get Started Free
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center px-8 py-4 bg-white hover:bg-gray-50 text-blue-600 font-semibold rounded-lg border-2 border-blue-600 transition-colors text-lg"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-sm text-gray-500">
          Start with 3 free credits • No credit card required
        </p>
      </div>
    </main>
  );
}
