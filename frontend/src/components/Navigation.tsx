'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Container } from '@/components/ui/Container';
import { Tagline } from '@/components/ui/Tagline';
import { UserMenu } from './UserMenu';

export const Navigation: React.FC = () => {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // SECURITY: Never show navigation if user is not authenticated
  // This prevents any navigation links from being visible to unauthenticated users
  // Even during loading, don't show navigation if we don't have a user
  if (!user) {
    return null;
  }
  
  // During loading, also don't show navigation to prevent flash
  // Only show navigation when we have confirmed authentication
  if (loading) {
    return null;
  }

  const linkBase =
    'px-3 py-2 rounded-cozy-md text-cozy-body font-serif font-medium transition-colors text-cozy-text hover:text-cozy-accent hover:underline';
  const linkActive = 'text-cozy-accent underline bg-cozy-mount';

  return (
    <nav className="bg-cozy-surface shadow-sm border-b border-cozy-borderCard border-t-2 border-t-cozy-accent">
      <Container className="py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex flex-col gap-0.5">
            <span className="font-serif text-cozy-logo text-cozy-accent font-normal">
              Rekindle
            </span>
            <Tagline>Your memories, gently kept</Tagline>
          </Link>
          
          <div className="flex items-center space-x-4">
            {/* Navigation Links */}
            <div className="flex space-x-4">
              <Link
                href="/upload"
                className={`${linkBase} ${pathname === '/upload' ? linkActive : ''}`}
              >
                Upload
              </Link>
              <Link
                href="/gallery"
                className={`${linkBase} ${pathname === '/gallery' ? linkActive : ''}`}
              >
                Gallery
              </Link>
              <Link
                href="/subscription"
                className={`${linkBase} ${pathname === '/subscription' ? linkActive : ''}`}
              >
                Subscription
              </Link>
            </div>

            {/* User Menu */}
            <UserMenu />
          </div>
        </div>
      </Container>
    </nav>
  );
};
