'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UserMenu } from './UserMenu';

export const Navigation: React.FC = () => {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // Don't show navigation if not signed in
  if (!loading && !user) {
    return null;
  }

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-blue-600">
            Rekindle
          </Link>
          
          <div className="flex items-center space-x-4">
            {/* Navigation Links */}
            <div className="flex space-x-4">
              <Link 
                href="/upload" 
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/upload' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Upload
              </Link>
              <Link 
                href="/gallery" 
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/gallery' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Gallery
              </Link>
              <Link 
                href="/subscription" 
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/subscription' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Subscription
              </Link>
            </div>

            {/* User Menu */}
            <UserMenu />
          </div>
        </div>
      </div>
    </nav>
  );
};
