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
        
        {/* Suppress browser extension errors - runs immediately and synchronously */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                'use strict';
                // CRITICAL: Set up error filtering IMMEDIATELY before any other code runs
                // This must be synchronous and run as early as possible
                
                // Store original console methods
                // Store both at instance and prototype level in case extensions cache references
                const originalError = window.console.error;
                const originalWarn = window.console.warn;
                const originalLog = window.console.log;
                
                // Helper to check if error is from extension
                // Based on common Bitwarden/password manager extension errors
                function isExtensionError(message, stack, filename) {
                  if (!message && !stack && !filename) return false;
                  // Combine all text for comprehensive checking
                  const combined = ((message || '') + ' ' + (stack || '') + ' ' + (filename || '')).toLowerCase();
                  
                  // Comprehensive list of extension error patterns
                  // Includes VM scripts (VM3489 bootstrap-autofill-overlay.js)
                  const extensionPatterns = [
                    'extension context invalidated',
                    'bootstrap-autofill-overlay',
                    'bootstrap-autofill.js',
                    'autofilloverlaycontentservice',
                    'autofillinlinemenucontentservice',
                    'autofilloverlay',
                    'extension://',
                    'chrome-extension://',
                    'moz-extension://',
                    'edge-extension://',
                    'sendextensionmessage',
                    'handlewindowfocusoutevent',
                    'vm\\d+ bootstrap-autofill', // Matches VM3489, VM6869, etc.
                    'bootstrap-autofill-overlay.js:'
                  ];
                  
                  return extensionPatterns.some(pattern => {
                    try {
                      // Use regex for VM pattern, string includes for others
                      if (pattern.includes('vm\\d+')) {
                        return /vm\d+\s+bootstrap-autofill/i.test(combined);
                      }
                      return combined.includes(pattern);
                    } catch (e) {
                      return combined.includes(pattern);
                    }
                  });
                }
                
                // Override console.error with comprehensive error extraction
                window.console.error = function(...args) {
                  let message = '';
                  let stack = '';
                  
                  for (const arg of args) {
                    if (typeof arg === 'string') {
                      message += arg + ' ';
                    } else if (arg instanceof Error) {
                      message += (arg.message || '') + ' ' + (arg.name || '') + ' ';
                      stack += (arg.stack || '') + ' ';
                    } else if (arg && typeof arg === 'object') {
                      message += (arg.message || arg.toString() || '') + ' ';
                      stack += (arg.stack || '') + ' ';
                      if (arg.name) message += arg.name + ' ';
                      if (arg.constructor && arg.constructor.name) {
                        message += arg.constructor.name + ' ';
                      }
                    } else {
                      message += String(arg) + ' ';
                    }
                  }
                  
                  if (isExtensionError(message, stack, '')) {
                    return; // Silently ignore extension errors
                  }
                  
                  return originalError.apply(console, args);
                };
                
                // Override console.warn
                window.console.warn = function(...args) {
                  // Extract all possible error information
                  let message = '';
                  let stack = '';
                  
                  for (const arg of args) {
                    if (typeof arg === 'string') {
                      message += arg + ' ';
                    } else if (arg && typeof arg === 'object') {
                      message += (arg.message || arg.toString() || '') + ' ';
                      stack += (arg.stack || '') + ' ';
                    } else {
                      message += String(arg) + ' ';
                    }
                  }
                  
                  if (isExtensionError(message, stack, '')) {
                    return; // Silently ignore
                  }
                  originalWarn.apply(console, args);
                };
                
                // Catch unhandled promise rejections (most common for extension errors)
                // Add listeners in BOTH capture and bubble phases for maximum coverage
                const handleUnhandledRejection = function(e) {
                  const reason = e.reason;
                  if (!reason) return;
                  
                  const message = reason.message || reason.toString() || '';
                  const stack = reason.stack || '';
                  
                  if (isExtensionError(message, stack, '')) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    e.stopPropagation();
                    return false;
                  }
                };
                
                // Capture phase (runs first)
                window.addEventListener('unhandledrejection', handleUnhandledRejection, true);
                // Bubble phase (backup)
                window.addEventListener('unhandledrejection', handleUnhandledRejection, false);
                
                // Catch all window errors
                // Add listeners in BOTH capture and bubble phases
                const handleError = function(e) {
                  const message = e.message || '';
                  const filename = e.filename || e.source || '';
                  const stack = (e.error && e.error.stack) || '';
                  
                  if (isExtensionError(message, stack, filename)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    e.stopPropagation();
                    return false;
                  }
                };
                
                // Capture phase (runs first)
                window.addEventListener('error', handleError, true);
                // Bubble phase (backup)
                window.addEventListener('error', handleError, false);
                
                // Development-only: Handle Next.js syntax errors
                ${process.env.NODE_ENV === 'development' ? `
                const retryKey = 'nextjs-dev-retry';
                const hasRetried = sessionStorage.getItem(retryKey);
                
                window.addEventListener('error', function(e) {
                  if (e.message && e.message.includes('SyntaxError') && 
                      (e.filename && (e.filename.includes('_next') || e.filename.includes('layout.js')))) {
                    console.warn('Detected Next.js build syntax error, this usually means the dev server is still compiling...');
                    
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
                }, false);
                
                setTimeout(function() {
                  sessionStorage.removeItem(retryKey);
                }, 5000);
                ` : ''}
              })();
            `,
          }}
        />
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