'use client';

import { PhotoUploadContainer } from '@/components/PhotoUpload/PhotoUploadContainer';
import { RequireAuth } from '@/components/RequireAuth';

/**
 * Upload Page
 * 
 * Protected page for uploading and processing photos.
 * Users must be signed in to access this page.
 */
export default function UploadPage() {
  return (
    <RequireAuth>
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Bring Your Memories to Life
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Transform old, damaged, or faded family photos into vibrant, restored memories with professional-grade AI.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <PhotoUploadContainer 
              onUploadComplete={(result) => console.log('Upload complete:', result)}
              onError={(error) => console.error('Upload error:', error)}
            />
          </div>

          {/* Navigation to Gallery */}
          <div className="text-center mt-8">
            <a 
              href="/gallery"
              className="inline-flex items-center px-6 py-3 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              📸 View Photo Gallery
            </a>
          </div>
        </div>
      </main>
    </RequireAuth>
  );
}

