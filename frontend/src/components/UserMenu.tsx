'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * UserMenu Component
 * 
 * Displays user's profile picture and name with a dropdown menu.
 * Dropdown includes logout option.
 */
export const UserMenu: React.FC = () => {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Don't render if not signed in or loading
  if (loading || !user) {
    return null;
  }

  // Get user display name (from user_metadata or email)
  const displayName = user.user_metadata?.full_name 
    || user.user_metadata?.name 
    || user.user_metadata?.display_name
    || user.email?.split('@')[0] 
    || 'User';

  // Get user profile picture (from user_metadata or default)
  const profilePicture = user.user_metadata?.avatar_url 
    || user.user_metadata?.picture
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=8b6f47&color=fff&size=128`;

  const handleSignOut = async () => {
    setIsOpen(false);
    const { error } = await signOut();
    
    if (error) {
      console.error('Error signing out:', error);
      // Still redirect even if there's an error
    }
    
    // Redirect to landing page after sign out
    router.push('/');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* User Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-cozy-md hover:bg-cozy-mount transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cozy-accent focus-visible:ring-offset-2"
        aria-label="User menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {/* Profile Picture */}
        <div className="w-8 h-8 rounded-full overflow-hidden bg-cozy-mount flex-shrink-0">
          <img
            src={profilePicture}
            alt={displayName}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to default avatar if image fails to load
              const target = e.target as HTMLImageElement;
              target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=8b6f47&color=fff&size=128`;
            }}
          />
        </div>
        
        {/* User Name */}
        <span className="text-sm font-medium text-cozy-heading hidden sm:block">
          {displayName}
        </span>
        
        {/* Dropdown Arrow */}
        <svg
          className={`w-4 h-4 text-cozy-textSecondary transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-cozy-surface border border-cozy-borderCard rounded-cozy-lg shadow-cozy-card py-1 z-50">
          {/* User Info Section */}
          <div className="px-4 py-3 border-b border-cozy-borderCard">
            <p className="text-sm font-medium text-cozy-heading">{displayName}</p>
            <p className="text-xs text-cozy-textSecondary truncate">{user.email}</p>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2 text-sm text-cozy-text hover:bg-cozy-mount transition-colors flex items-center space-x-2"
            >
              <svg
                className="w-4 h-4 text-cozy-textSecondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};



