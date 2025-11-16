import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { DevMenu } from '@/components/DevMenu';
import { AppInitializationProvider } from '@/components/AppInitializationProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { Navigation } from '@/components/Navigation';
import { GlobalCreditBalanceBar } from '@/components/GlobalCreditBalanceBar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Rekindle - Restore Your Memories',
  description: "Transform old, damaged, or faded family photos into vibrant, restored memories with professional-grade AI.",
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.ico',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Rekindle',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#3b82f6',
  viewportFit: 'cover', // Use full screen including safe areas
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Rekindle" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <meta name="msapplication-tap-highlight" content="no" />
        
        {/* Hide mobile home indicator and use full viewport */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        
        {/* Camera permissions for PWA */}
        <meta name="permissions-policy" content="camera=*, microphone=*, geolocation=*" />
        
        {/* Development: Handle syntax errors from incomplete builds */}
        {process.env.NODE_ENV === 'development' && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  // Track if we've already retried
                  const retryKey = 'nextjs-dev-retry';
                  const hasRetried = sessionStorage.getItem(retryKey);
                  
                  // Listen for syntax errors (uncaught syntax errors)
                  window.addEventListener('error', function(e) {
                    // Check if it's a syntax error in a Next.js bundle
                    if (e.message && e.message.includes('SyntaxError') && 
                        (e.filename && e.filename.includes('_next') || e.filename.includes('layout.js'))) {
                      console.warn('Detected Next.js build syntax error, this usually means the dev server is still compiling...');
                      
                      // Only retry once
                      if (!hasRetried) {
                        sessionStorage.setItem(retryKey, 'true');
                        console.log('Retrying page load in 2 seconds...');
                        setTimeout(function() {
                          window.location.reload();
                        }, 2000);
                      } else {
                        console.error('Syntax error persists after retry. The dev server may need more time to compile.');
                      }
                    }
                  });
                  
                  // Clear retry flag after successful load (after a delay)
                  setTimeout(function() {
                    sessionStorage.removeItem(retryKey);
                  }, 5000);
                })();
              `,
            }}
          />
        )}
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <AppInitializationProvider>
            <Navigation />
            <GlobalCreditBalanceBar />
            {children}
            <DevMenu />
          </AppInitializationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}