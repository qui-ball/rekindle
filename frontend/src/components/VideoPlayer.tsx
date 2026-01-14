'use client';

import React, { useRef, useState, useCallback } from 'react';

interface VideoPlayerProps {
  videoUrl: string;
  onDownload?: () => void;
  autoPlay?: boolean;
  loop?: boolean;
  className?: string;
  poster?: string;
}

/**
 * VideoPlayer Component
 *
 * A simple video player with:
 * - Play/pause controls
 * - Download button
 * - Fullscreen support
 * - Loading state
 */
export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  onDownload,
  autoPlay = false,
  loop = true,
  className = '',
  poster,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Handle play/pause toggle
  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // Handle video loaded
  const handleLoadedData = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  // Handle video error
  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  // Handle play event
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  // Handle pause event
  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // Handle download
  const handleDownload = useCallback(() => {
    if (onDownload) {
      onDownload();
      return;
    }

    // Default download behavior
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = `animation-${Date.now()}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [videoUrl, onDownload]);

  // Handle fullscreen
  const handleFullscreen = useCallback(() => {
    if (!videoRef.current) return;

    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  }, []);

  // Error state
  if (hasError) {
    return (
      <div className={`bg-gray-100 rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-center p-6">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-gray-600">Failed to load video</p>
          <button
            onClick={() => {
              setHasError(false);
              setIsLoading(true);
              if (videoRef.current) {
                videoRef.current.load();
              }
            }}
            className="mt-2 text-xs text-blue-600 hover:text-blue-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-black rounded-lg overflow-hidden ${className}`}>
      {/* Video element */}
      <video
        ref={videoRef}
        src={videoUrl}
        autoPlay={autoPlay}
        loop={loop}
        playsInline
        muted
        poster={poster}
        onLoadedData={handleLoadedData}
        onError={handleError}
        onPlay={handlePlay}
        onPause={handlePause}
        className="w-full h-full object-contain"
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center">
          <svg
            className="animate-spin h-10 w-10 text-white"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}

      {/* Controls overlay */}
      {!isLoading && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          <div className="flex items-center justify-between">
            {/* Play/Pause button */}
            <button
              onClick={handlePlayPause}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Right side controls */}
            <div className="flex items-center space-x-2">
              {/* Download button */}
              <button
                onClick={handleDownload}
                className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                aria-label="Download video"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </button>

              {/* Fullscreen button */}
              <button
                onClick={handleFullscreen}
                className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                aria-label="Fullscreen"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
