'use client';

import { PhotoManagementContainer } from '@/components/PhotoManagement/PhotoManagementContainer';

export default function GalleryPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Your Photo Gallery
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            View and manage all your processed photos
          </p>
        </div>

        <div className="max-w-7xl mx-auto">
          <PhotoManagementContainer 
            userId="user@example.com" // Real user ID from database
            onPhotoSelect={(photo) => console.log('Photo selected:', photo)}
            onProcessingComplete={(result) => console.log('Processing complete:', result)}
            onError={(error) => console.error('Gallery error:', error)}
          />
        </div>
      </div>
    </main>
  );
}
