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
 * Create a Supabase client for use in client components
 * This client automatically handles cookies and session management
 */
export const createClient = () => {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
};

/**
 * Default Supabase client instance
 * Use this in client components when you need a simple client instance
 */
export const supabase = createClient();

