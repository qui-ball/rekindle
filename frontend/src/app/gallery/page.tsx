'use client';

import { Container } from '@/components/ui/Container';
import { Headline } from '@/components/ui/Headline';
import { Body } from '@/components/ui/Body';
import { PhotoManagementContainer } from '@/components/PhotoManagement/PhotoManagementContainer';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/contexts/AuthContext';

function GalleryContent() {
  const { user } = useAuth();

  // User is guaranteed to be authenticated here because of RequireAuth wrapper
  // But add a safety check just in case
  if (!user) {
    return (
      <main className="min-h-screen bg-cozy-background flex items-center justify-center">
        <div className="text-cozy-textSecondary text-cozy-caption">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cozy-background flex flex-col overflow-hidden">
      <Container className="flex-shrink-0 py-8" verticalPadding={false}>
        <div className="text-center mb-8">
          <Headline level={1} className="mb-4 text-cozy-heading">
            Your Photo Gallery
          </Headline>
          <Body className="text-cozy-text text-xl max-w-2xl mx-auto">
            View and manage all your processed photos
          </Body>
        </div>
      </Container>

      <Container className="flex-1 overflow-hidden pb-8 max-w-7xl" verticalPadding={false}>
        <PhotoManagementContainer
          userId={user.email ?? ''}
          onPhotoSelect={(photo) => console.log('Photo selected:', photo)}
          onProcessingComplete={(result) => console.log('Processing complete:', result)}
          onError={(error) => console.error('Gallery error:', error)}
        />
      </Container>
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
