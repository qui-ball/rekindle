/**
 * Photo Service
 * 
 * Service for managing photos using the new user-scoped photo API endpoints.
 * All operations require authentication and are automatically scoped to the current user.
 */

import { getSupabaseClient } from '@/lib/supabase';

/**
 * Get authentication token from Supabase session
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
 * Photo API response types matching backend schemas
 */
export interface Photo {
  id: string;
  owner_id: string;
  original_key: string;
  processed_key?: string;
  thumbnail_key?: string;
  storage_bucket: string;
  status: 'uploaded' | 'processing' | 'ready' | 'archived' | 'deleted';
  size_bytes?: number;
  mime_type?: string;
  checksum_sha256: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  original_url?: string;
  processed_url?: string;
  thumbnail_url?: string;
}

export interface PhotoListResponse {
  photos: Photo[];
  total: number;
  limit: number;
  offset: number;
}

export interface PhotoPresignedUrlResponse {
  url: string;
  expires_in: number;
}

export interface PhotoUpdate {
  metadata?: Record<string, unknown>;
}

/**
 * Photo Service class
 */
export class PhotoService {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  /**
   * List photos for the current user
   */
  async listPhotos(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<PhotoListResponse> {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const url = `${this.baseUrl}/v1/photos${queryParams.toString() ? `?${queryParams}` : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/sign-in?error=Session expired. Please sign in again.';
        throw new Error('Authentication required');
      }
      const error = await response.json();
      throw new Error(error.detail || 'Failed to list photos');
    }

    return response.json();
  }

  /**
   * Get a specific photo by ID
   */
  async getPhoto(photoId: string): Promise<Photo> {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${this.baseUrl}/v1/photos/${photoId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/sign-in?error=Session expired. Please sign in again.';
        throw new Error('Authentication required');
      }
      if (response.status === 404) {
        throw new Error('Photo not found');
      }
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get photo');
    }

    return response.json();
  }

  /**
   * Get a presigned download URL for a photo
   */
  async getDownloadUrl(
    photoId: string,
    keyType: 'original' | 'processed' | 'thumbnail' = 'original',
    expiration: number = 3600
  ): Promise<PhotoPresignedUrlResponse> {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(
      `${this.baseUrl}/v1/photos/${photoId}/download-url?key_type=${keyType}&expiration=${expiration}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/sign-in?error=Session expired. Please sign in again.';
        throw new Error('Authentication required');
      }
      if (response.status === 404) {
        throw new Error('Photo not found');
      }
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get download URL');
    }

    return response.json();
  }

  /**
   * Update photo metadata
   */
  async updatePhoto(photoId: string, update: PhotoUpdate): Promise<Photo> {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${this.baseUrl}/v1/photos/${photoId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(update),
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/sign-in?error=Session expired. Please sign in again.';
        throw new Error('Authentication required');
      }
      if (response.status === 404) {
        throw new Error('Photo not found');
      }
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update photo');
    }

    return response.json();
  }

  /**
   * Delete a photo (soft delete)
   */
  async deletePhoto(photoId: string): Promise<void> {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${this.baseUrl}/v1/photos/${photoId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/sign-in?error=Session expired. Please sign in again.';
        throw new Error('Authentication required');
      }
      if (response.status === 404) {
        throw new Error('Photo not found');
      }
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete photo');
    }
  }
}

// Export singleton instance
export const photoService = new PhotoService();

