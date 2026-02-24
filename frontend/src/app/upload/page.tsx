'use client';

import { Container, Headline, Body, Button } from '@/components/ui';
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
      <main className="min-h-screen bg-cozy-background">
        <Container className="py-8" verticalPadding={false}>
          <div className="text-center mb-8">
            <Headline level={1} className="text-cozy-heading mb-4">
              Bring Your Memories to Life
            </Headline>
            <Body className="text-cozy-text text-xl max-w-2xl mx-auto">
              Transform old, damaged, or faded family photos into vibrant, restored memories with professional-grade AI.
            </Body>
          </div>

          <div className="max-w-4xl mx-auto">
            <PhotoUploadContainer
              onUploadComplete={(result) => console.log('Upload complete:', result)}
              onError={(error) => console.error('Upload error:', error)}
            />
          </div>

          <div className="text-center mt-8">
            <Button href="/gallery" variant="secondary">
              📸 View Photo Gallery
            </Button>
          </div>
        </Container>
      </main>
    </RequireAuth>
  );
}

