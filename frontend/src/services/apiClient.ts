/**
 * API Client with Authentication
 * 
 * Automatically includes JWT tokens from Supabase session in all API requests.
 * Handles token refresh and error responses.
 */

import { getSupabaseClient } from '@/lib/supabase';

/**
 * Get the current JWT access token from Supabase session
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      return null;
    }
    
    if (!session) {
      console.warn('No session found');
      return null;
    }
    
    // CRITICAL: Check if access_token exists and is valid
    if (!session.access_token) {
      console.error('CRITICAL: Session exists but no access_token!');
      console.error('Session data:', {
        hasUser: !!session.user,
        userId: session.user?.id,
        userEmail: session.user?.email,
        hasAccessToken: !!session.access_token,
        hasRefreshToken: !!session.refresh_token,
      });
      console.error('This may indicate a corrupted session or test data.');
      return null;
    }
    
    const token = session.access_token;
    
    // CRITICAL: Validate token is not a user ID
    if (token === session.user?.id || token.includes('supabase_user_id') || token.includes('user_id')) {
      console.error(`CRITICAL ERROR: Token appears to be a user ID instead of a JWT token!`);
      console.error(`Token value: ${token}`);
      console.error(`User ID: ${session.user?.id}`);
      console.error(`This is a bug - user ID is being used as a token!`);
      return null;
    }
    
    console.log('Token retrieved successfully, length:', token.length);
    console.log('Token preview (first 50 chars):', token.substring(0, 50));
    
    // Validate token format
    if (!token.startsWith('eyJ')) {
      console.error(`CRITICAL: Token does not look like a JWT! Full token value: ${token}`);
      console.error('This suggests the token is corrupted or a test value is being used.');
      console.error('User ID from session:', session.user?.id);
      console.error('This may indicate user ID is being used instead of token.');
      return null;
    }
    
    return token;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

/**
 * Create an authenticated fetch function
 */
async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Check if we're already on the sign-in page - don't redirect if we are
  const isOnSignInPage = typeof window !== 'undefined' && 
    (window.location.pathname === '/sign-in' || window.location.pathname.startsWith('/sign-in'));
  
  // Get the auth token - try refreshing if needed
  let token = await getAuthToken();
  
  // If no token, try refreshing the session first
  if (!token) {
    try {
      const supabase = getSupabaseClient();
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (!error && session?.access_token) {
        token = session.access_token;
      }
    } catch (refreshError) {
      console.error('Failed to refresh session:', refreshError);
    }
  }
  
  // Validate token format - must be a JWT (starts with "eyJ")
  if (token && !token.startsWith('eyJ')) {
    console.error(`Invalid token format detected! Token does not look like a JWT. Token preview: ${token.substring(0, 100)}`);
    // Try to refresh the session one more time
    try {
      const supabase = getSupabaseClient();
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (!error && session?.access_token && session.access_token.startsWith('eyJ')) {
        token = session.access_token;
        console.log('Token refreshed successfully after format validation failure');
      } else {
        console.error('Token refresh failed or returned invalid token format');
        token = null;
      }
    } catch (refreshError) {
      console.error('Failed to refresh session after format validation:', refreshError);
      token = null;
    }
  }
  
  // If still no token, only redirect if not already on sign-in page
  if (!token) {
    if (!isOnSignInPage && typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      // Only redirect if not already going to sign-in
      if (currentPath !== '/sign-in') {
        window.location.href = `/sign-in?error=Please sign in to continue.&next=${encodeURIComponent(currentPath)}`;
      }
    }
    throw new Error('Authentication required');
  }
  
  // CRITICAL: Final validation before sending - reject non-JWT tokens
  if (!token.startsWith('eyJ')) {
    console.error(`CRITICAL ERROR: Invalid token format detected! Token does not look like a JWT.`);
    console.error(`Token value: ${token}`);
    console.error(`Token length: ${token.length}`);
    console.error(`This suggests a user ID or test value is being used instead of a JWT token.`);
    console.error(`Stack trace:`, new Error().stack);
    
    // DO NOT send invalid token - throw error instead
    if (!isOnSignInPage && typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (currentPath !== '/sign-in') {
        window.location.href = `/sign-in?error=Authentication error. Please sign in again.&next=${encodeURIComponent(currentPath)}`;
      }
    }
    throw new Error(`Invalid token format: token does not appear to be a valid JWT. This may indicate a bug where a user ID is being used instead of a token.`);
  }
  
  // Add Authorization header
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  
  // Log the request (without full token for security)
  console.log(`Making authenticated request to: ${url}`);
  console.log(`Authorization header present: ${headers.has('Authorization')}`);
  console.log(`Token preview: ${token.substring(0, 20)}...`);
  console.log(`Token length: ${token.length}, starts with: ${token.substring(0, 50)}`);
  
  // Merge headers with existing options
  const fetchOptions: RequestInit = {
    ...options,
    headers,
  };
  
  // Make the request
  const response = await fetch(url, fetchOptions);
  
  console.log(`Response status: ${response.status} ${response.statusText}`);
  
  // Handle 401 Unauthorized - token might be expired or invalid
  if (response.status === 401) {
    console.log('API returned 401, checking session...');
    
    // Check current session first - if we have a valid session, don't redirect
    // The 401 might be a temporary backend issue, not an auth failure
    const supabase = getSupabaseClient();
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    
    // If we have a valid session with token, try refreshing and retrying
    // But don't redirect immediately - the session might still be valid
    if (currentSession && currentSession.access_token) {
      console.log('Have valid session, trying refresh and retry...');
      const { data: { session: refreshedSession }, error } = await supabase.auth.refreshSession();
      
      if (!error && refreshedSession && refreshedSession.access_token) {
        // Session refreshed - retry the request
        headers.set('Authorization', `Bearer ${refreshedSession.access_token}`);
        const retryResponse = await fetch(url, { ...options, headers });
        
        if (retryResponse.ok) {
          console.log('Retry succeeded after refresh');
          return retryResponse;
        }
        
        // Retry still failed - but we had a valid session, so don't redirect
        // Just throw the error and let the caller handle it
        if (retryResponse.status === 401) {
          const errorText = await retryResponse.text();
          console.warn('Retry still returned 401 despite valid session:', errorText);
          throw new Error(`GET ${url} failed: 401 Unauthorized - ${errorText}`);
        }
        
        return retryResponse;
      }
    }
    
    // No valid session - try to refresh one more time
    const { data: { session: refreshedSession }, error } = await supabase.auth.refreshSession();
    
    if (error || !refreshedSession || !refreshedSession.access_token) {
      // Session refresh failed - only redirect if not already on sign-in page
      console.log('No valid session and refresh failed, redirecting...');
      if (!isOnSignInPage && typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        // Only redirect if not already going to sign-in
        if (currentPath !== '/sign-in') {
          window.location.href = `/sign-in?error=Session expired. Please sign in again.&next=${encodeURIComponent(currentPath)}`;
        }
      }
      throw new Error('Session expired');
    }
    
    // Retry the request with the refreshed token
    headers.set('Authorization', `Bearer ${refreshedSession.access_token}`);
    const retryResponse = await fetch(url, { ...options, headers });
    
    // If retry still fails with 401, only redirect if not already on sign-in page
    if (retryResponse.status === 401) {
      const errorText = await retryResponse.text();
      console.warn('Retry still returned 401 after refresh:', errorText);
      // Check if we still have a session - if yes, don't redirect (might be backend issue)
      const { data: { session: checkSession } } = await supabase.auth.getSession();
      if (!checkSession || !checkSession.access_token) {
        // No session - redirect
        if (!isOnSignInPage && typeof window !== 'undefined') {
          const currentPath = window.location.pathname;
          if (currentPath !== '/sign-in') {
            window.location.href = `/sign-in?error=Session expired. Please sign in again.&next=${encodeURIComponent(currentPath)}`;
          }
        }
      }
      // Even if we have a session, throw the error so caller can handle it
      throw new Error(`GET ${url} failed: 401 Unauthorized - ${errorText}`);
    }
    
    return retryResponse;
  }
  
  // Handle 403 Forbidden - user doesn't have permission
  if (response.status === 403) {
    throw new Error('You do not have permission to access this resource');
  }
  
  // Handle 402 Payment Required - insufficient credits
  if (response.status === 402) {
    throw new Error('Insufficient credits. Please purchase more credits to continue.');
  }
  
  return response;
}

/**
 * API Client class that wraps fetch with authentication
 */
export class ApiClient {
  private baseUrl: string;
  
  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }
  
  /**
   * GET request with authentication
   */
  async get<T>(path: string, options?: RequestInit): Promise<T> {
    try {
      const response = await authenticatedFetch(`${this.baseUrl}${path}`, {
        ...options,
        method: 'GET',
      });
      
      // 200-299 are success status codes
      // Empty arrays are valid responses (200 OK with [])
      if (!response.ok) {
        // For 401, authenticatedFetch already handled redirect, so just throw
        // For other errors, throw with details
        const errorText = await response.text();
        console.error(`API GET ${path} failed: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`GET ${path} failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      // Parse JSON response - empty array [] is valid
      const data = await response.json();
      return data;
    } catch (error) {
      // If error is about authentication/redirect, re-throw it
      // Otherwise, wrap it in a more descriptive error
      if (error instanceof Error && (error.message.includes('Authentication required') || error.message.includes('Session expired'))) {
        throw error;
      }
      throw error;
    }
  }
  
  /**
   * POST request with authentication
   */
  async post<T>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    const response = await authenticatedFetch(`${this.baseUrl}${path}`, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`POST ${path} failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return response.json();
  }
  
  /**
   * PUT request with authentication
   */
  async put<T>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    const response = await authenticatedFetch(`${this.baseUrl}${path}`, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PUT ${path} failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return response.json();
  }
  
  /**
   * DELETE request with authentication
   */
  async delete<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await authenticatedFetch(`${this.baseUrl}${path}`, {
      ...options,
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DELETE ${path} failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    // DELETE might not return JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    
    return {} as T;
  }
  
  /**
   * Fetch blob (for downloads)
   */
  async getBlob(path: string, options?: RequestInit): Promise<Blob> {
    const response = await authenticatedFetch(`${this.baseUrl}${path}`, {
      ...options,
      method: 'GET',
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GET ${path} failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return response.blob();
  }
}

// Export a default instance
export const apiClient = new ApiClient();


