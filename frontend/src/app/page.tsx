'use client';

import { PhotoUploadContainer } from '@/components/PhotoUpload/PhotoUploadContainer';
import Link from 'next/link';

export default function HomePage() {
  return (
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

        {/* Development Test Links */}
        <div className="mt-12 text-center">
          <div className="inline-flex flex-wrap gap-4 p-4 bg-white rounded-lg shadow-sm">
            <h3 className="w-full text-lg font-semibold text-gray-700 mb-2">Development Tests:</h3>
            <Link 
              href="/native-camera-test" 
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              🔬 Native Camera Test
            </Link>
            <Link 
              href="/camera-test" 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              📷 Camera Test (Old)
            </Link>
            <Link 
              href="/test-cropper" 
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              ✂️ Cropper Test
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}