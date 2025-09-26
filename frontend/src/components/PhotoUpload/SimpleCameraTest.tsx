/**
 * SimpleCameraTest Component
 * 
 * Minimal camera test to debug permission and initialization issues
 */

import React, { useState, useRef, useEffect } from 'react';

export const SimpleCameraTest: React.FC = () => {
  const [status, setStatus] = useState<string>('Not started');
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startCamera = async () => {
    try {
      setStatus('Requesting camera access...');
      setError(null);
      
      console.log('Starting camera test...');
      
      // Check if MediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser');
      }
      
      console.log('MediaDevices API available');
      
      // Try the simplest possible constraints first
      const constraints = {
        video: true,
        audio: false
      };
      
      console.log('Requesting camera with constraints:', constraints);
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('Camera stream obtained:', mediaStream);
      console.log('Video tracks:', mediaStream.getVideoTracks());
      
      setStream(mediaStream);
      setStatus('Camera stream obtained');
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded');
          setStatus('Camera ready');
          
          if (videoRef.current) {
            console.log('Video dimensions:', 
              videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
          }
        };
        
        videoRef.current.onerror = (e) => {
          console.error('Video error:', e);
          setError('Video playback failed');
        };
        
        try {
          await videoRef.current.play();
          console.log('Video playing');
        } catch (playError) {
          console.warn('Autoplay failed:', playError);
          setStatus('Camera ready (click to play)');
        }
      }
      
    } catch (err) {
      console.error('Camera error:', err);
      const error = err as Error;
      setError(`${error.name}: ${error.message}`);
      setStatus('Failed');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        console.log('Stopping track:', track);
        track.stop();
      });
      setStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setStatus('Stopped');
    setError(null);
  };

  // Auto-start for testing
  useEffect(() => {
    startCamera();
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Simple Camera Test</h2>
      
      <div className="mb-4 p-4 bg-gray-100 rounded">
        <p><strong>Status:</strong> {status}</p>
        {error && <p className="text-red-600"><strong>Error:</strong> {error}</p>}
      </div>
      
      <div className="mb-4 space-x-4">
        <button
          onClick={startCamera}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Start Camera
        </button>
        <button
          onClick={stopCamera}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Stop Camera
        </button>
      </div>
      
      <div className="border rounded-lg overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="w-full h-auto"
          playsInline
          muted
          controls={false}
          style={{ maxHeight: '400px' }}
        />
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <p>Check the browser console for detailed logs.</p>
        <p>This test uses the simplest possible camera constraints.</p>
      </div>
    </div>
  );
};

export default SimpleCameraTest;