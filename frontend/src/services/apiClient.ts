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
    
    if (error || !session) {
      return null;
    }
    
    return session.access_token;
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
  // Get the auth token
  const token = await getAuthToken();
  
  // Add Authorization header if token is available
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('Content-Type', 'application/json');
  
  // Merge headers with existing options
  const fetchOptions: RequestInit = {
    ...options,
    headers,
  };
  
  // Make the request
  const response = await fetch(url, fetchOptions);
  
  // Handle 401 Unauthorized - token might be expired or invalid
  if (response.status === 401) {
    // Try to refresh the session
    const supabase = getSupabaseClient();
    const { data: { session }, error } = await supabase.auth.refreshSession();
    
    if (error || !session) {
      // Session refresh failed - redirect to sign-in
      window.location.href = '/sign-in?error=Session expired. Please sign in again.';
      throw new Error('Session expired');
    }
    
    // Retry the request with the new token
    headers.set('Authorization', `Bearer ${session.access_token}`);
    return fetch(url, { ...options, headers });
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
    const response = await authenticatedFetch(`${this.baseUrl}${path}`, {
      ...options,
      method: 'GET',
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GET ${path} failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return response.json();
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


