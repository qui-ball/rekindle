'use client';

import { PhotoUploadContainer } from '@/components/PhotoUpload/PhotoUploadContainer';

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


      </div>
    </main>
  );
}