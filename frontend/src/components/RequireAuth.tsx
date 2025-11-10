'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface RequireAuthProps {
  children: ReactNode;
  redirectTo?: string;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({
  children,
  redirectTo,
}) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      const target = redirectTo ?? pathname ?? '/';
      const params = new URLSearchParams();
      if (target && target !== '/') {
        params.set('redirect', target);
      }
      router.replace(`/sign-in${params.toString() ? `?${params}` : ''}`);
    }
  }, [loading, redirectTo, user, router, pathname]);

  if (loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">Checking your session…</div>
      </main>
    );
  }

  return <>{children}</>;
};

export default RequireAuth;

