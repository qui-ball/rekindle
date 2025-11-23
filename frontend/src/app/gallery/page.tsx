'use client';

import { PhotoManagementContainer } from '@/components/PhotoManagement/PhotoManagementContainer';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/contexts/AuthContext';

function GalleryContent() {
  const { user } = useAuth();
  
  // User is guaranteed to be authenticated here because of RequireAuth wrapper
  // But add a safety check just in case
  if (!user) {
    return (
      <main className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading...</div>
      </main>
    );
  }

  return (
    <main className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Your Photo Gallery
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            View and manage all your processed photos
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden container mx-auto px-4 pb-8 max-w-7xl">
        <PhotoManagementContainer 
          userId={user.email} // Use authenticated user's email
          onPhotoSelect={(photo) => console.log('Photo selected:', photo)}
          onProcessingComplete={(result) => console.log('Processing complete:', result)}
          onError={(error) => console.error('Gallery error:', error)}
        />
      </div>
    </main>
  );
}

export default function GalleryPage() {
  return (
    <RequireAuth>
      <GalleryContent />
    </RequireAuth>
  );
}
