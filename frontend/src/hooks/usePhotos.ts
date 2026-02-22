/**
 * usePhotos Hook
 * 
 * React hook for managing photo list and operations.
 * Provides loading states, error handling, and automatic refresh.
 */

import { useState, useEffect, useCallback } from 'react';
import { photoService, Photo, PhotoListResponse } from '../services/photoService';

interface UsePhotosOptions {
  status?: string;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UsePhotosReturn {
  photos: Photo[];
  total: number;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

/**
 * Hook for listing and managing photos
 */
export const usePhotos = (options: UsePhotosOptions = {}): UsePhotosReturn => {
  const {
    status,
    limit = 50,
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds
  } = options;

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  /**
   * Load photos from API
   */
  const loadPhotos = useCallback(async (reset: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      const currentOffset = reset ? 0 : offset;
      const response: PhotoListResponse = await photoService.listPhotos({
        status,
        limit,
        offset: currentOffset,
      });

      if (reset) {
        setPhotos(response.photos);
        setOffset(response.photos.length);
      } else {
        setPhotos(prev => [...prev, ...response.photos]);
        setOffset(prev => prev + response.photos.length);
      }

      setTotal(response.total);
      setHasMore(response.photos.length === limit && (currentOffset + response.photos.length) < response.total);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load photos');
      setError(error);
      console.error('Error loading photos:', error);
    } finally {
      setLoading(false);
    }
  }, [status, limit, offset]);

  /**
   * Refresh photos list
   */
  const refresh = useCallback(async () => {
    await loadPhotos(true);
  }, [loadPhotos]);

  /**
   * Load more photos (pagination)
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    await loadPhotos(false);
  }, [hasMore, loading, loadPhotos]);

  // Initial load
  useEffect(() => {
    loadPhotos(true);
  }, [status]); // Reload when status filter changes

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refresh();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refresh]);

  return {
    photos,
    total,
    loading,
    error,
    refresh,
    loadMore,
    hasMore,
  };
};

/**
 * Hook for getting a single photo
 */
export const usePhoto = (photoId: string | null) => {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadPhoto = useCallback(async () => {
    if (!photoId) {
      setPhoto(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await photoService.getPhoto(photoId);
      setPhoto(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load photo');
      setError(error);
      console.error('Error loading photo:', error);
    } finally {
      setLoading(false);
    }
  }, [photoId]);

  useEffect(() => {
    loadPhoto();
  }, [loadPhoto]);

  return {
    photo,
    loading,
    error,
    refresh: loadPhoto,
  };
};

