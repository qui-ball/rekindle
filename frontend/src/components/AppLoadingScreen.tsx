// Simple loading screen component (now used only for critical app failures)
'use client';

import React from 'react';

interface AppLoadingScreenProps {
  progress: number;
  message: string;
  status: 'loading' | 'ready' | 'fallback';
  error?: string;
}

export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({
  message,
  error
}) => {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center z-50">
      <div className="max-w-md w-full mx-4">
        {/* App Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Rekindle
          </h1>
          <p className="text-lg text-gray-600">
            Bring Your Memories to Life
          </p>
        </div>

        {/* Error Content */}
        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="text-red-600 mb-4">
            <p className="mb-2">⚠️ App Loading Issue</p>
            <p className="text-sm text-gray-600">{message}</p>
            {error && (
              <p className="text-xs text-gray-500 mt-2">{error}</p>
            )}
          </div>
          
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reload App
          </button>
        </div>
      </div>
    </div>
  );
};