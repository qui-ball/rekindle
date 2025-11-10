/**
 * Supabase Client Configuration
 * 
 * This file initializes the Supabase client for use in client components.
 * For server components and API routes, use the createClient() functions from @supabase/ssr
 */

import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
  );
}

/**
 * Normalize Supabase URL for client-side use
 * 
 * In Docker development, the URL may be set to `http://host.docker.internal:54321`
 * for server-side code, but browsers can't resolve `host.docker.internal`.
 * This function replaces it with the appropriate hostname for browser use:
 * - If accessed via IP address (mobile), use the same IP
 * - Otherwise, use localhost
 * 
 * Note: This is a client-side module, so we always normalize the URL.
 */
function normalizeSupabaseUrl(url: string): string {
  // Check if we're accessing via IP address (mobile device)
  const isIPAddress = typeof window !== 'undefined' && 
    /^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname);
  
  if (isIPAddress) {
    // Replace host.docker.internal with the current hostname (IP address)
    // This allows mobile devices to access Supabase
    const hostname = window.location.hostname;
    return url.replace(/host\.docker\.internal/g, hostname);
  }
  
  // Replace host.docker.internal with localhost for browser access
  // Browsers can't resolve host.docker.internal, so we use localhost instead
  return url.replace(/host\.docker\.internal/g, 'localhost');
}

/**
 * Create a Supabase client for use in client components
 * This client automatically handles cookies and session management
 * The URL is normalized dynamically based on the current hostname (localhost vs IP address)
 */
export const createClient = () => {
  // Normalize URL dynamically based on current hostname
  // This allows mobile devices to use IP addresses instead of localhost
  const normalizedUrl = normalizeSupabaseUrl(supabaseUrl);
  return createBrowserClient(normalizedUrl, supabaseAnonKey);
};

/**
 * Default Supabase client instance
 * Use this in client components when you need a simple client instance
 */
export const supabase = createClient();

